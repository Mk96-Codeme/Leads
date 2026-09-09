const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('../db/connection');
const { requireAdminAuth } = require('../middleware/auth');

const router = express.Router();

function generatePassword() {
  // Readable-ish random password for handing to a new client, e.g. "k4p9-wq2m"
  const part = () => crypto.randomBytes(3).toString('hex');
  return `${part()}-${part()}`;
}

router.get('/login', (req, res) => {
  if (req.session && req.session.adminId) {
    return res.redirect('/admin');
  }
  res.render('admin/login', { page: 'admin-login', error: null });
});

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  const admin = db.prepare('SELECT * FROM admin_users WHERE username = ?').get((username || '').trim());
  if (!admin || !bcrypt.compareSync(password || '', admin.password_hash)) {
    return res.status(401).render('admin/login', { page: 'admin-login', error: 'Incorrect username or password.' });
  }
  req.session.adminId = admin.id;
  res.redirect('/admin');
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/admin/login'));
});

// Everything below requires an authenticated admin session.
router.use(requireAdminAuth);

router.get('/', (req, res) => {
  const stats = {
    activeClients: db.prepare("SELECT COUNT(*) AS n FROM clients WHERE status = 'active'").get().n,
    leadsLast7: db
      .prepare("SELECT COUNT(*) AS n FROM leads WHERE received_at >= datetime('now', '-7 days')")
      .get().n,
    newInterest: db.prepare("SELECT COUNT(*) AS n FROM interest_submissions WHERE status = 'new'").get().n,
    revenueLast30Cents:
      db
        .prepare("SELECT COALESCE(SUM(resale_cost_cents),0) AS n FROM leads WHERE received_at >= datetime('now', '-30 days')")
        .get().n,
    marginLast30Cents:
      db
        .prepare(
          "SELECT COALESCE(SUM(resale_cost_cents - wholesale_cost_cents),0) AS n FROM leads WHERE received_at >= datetime('now', '-30 days')"
        )
        .get().n,
  };

  const recentLeads = db
    .prepare(
      `SELECT leads.*, clients.business_name FROM leads
       JOIN clients ON clients.id = leads.client_id
       ORDER BY leads.received_at DESC LIMIT 10`
    )
    .all();

  const recentInterest = db
    .prepare('SELECT * FROM interest_submissions ORDER BY created_at DESC LIMIT 8')
    .all();

  res.render('admin/dashboard', { page: 'admin-dashboard', stats, recentLeads, recentInterest });
});

// ---------- Leads ----------

router.get('/leads', (req, res) => {
  const leads = db
    .prepare(
      `SELECT leads.*, clients.business_name FROM leads
       JOIN clients ON clients.id = leads.client_id
       ORDER BY leads.received_at DESC`
    )
    .all();
  res.render('admin/leads', { page: 'admin-leads', leads });
});

router.get('/leads/new', (req, res) => {
  const clients = db.prepare("SELECT * FROM clients WHERE status = 'active' ORDER BY business_name").all();
  res.render('admin/lead-new', { page: 'admin-lead-new', clients, errors: null, values: {} });
});

router.post('/leads/new', (req, res) => {
  const {
    client_id,
    received_at,
    coverage_area,
    job_type,
    contact_name,
    contact_phone,
    contact_address,
    wholesale_cost,
    resale_cost,
    source,
    notes,
  } = req.body;

  const errors = [];
  if (!client_id) errors.push('Select a client to assign this lead to.');
  if (!coverage_area || !coverage_area.trim()) errors.push('Coverage area is required.');
  if (!job_type || !job_type.trim()) errors.push('Job type is required.');
  if (!contact_name || !contact_name.trim()) errors.push('Contact name is required.');
  if (!contact_phone || !contact_phone.trim()) errors.push('Contact phone is required.');
  const wholesaleNum = parseFloat(wholesale_cost);
  const resaleNum = parseFloat(resale_cost);
  if (isNaN(wholesaleNum) || wholesaleNum < 0) errors.push('Wholesale cost must be a valid number.');
  if (isNaN(resaleNum) || resaleNum < 0) errors.push('Resale cost must be a valid number.');

  if (errors.length) {
    const clients = db.prepare("SELECT * FROM clients WHERE status = 'active' ORDER BY business_name").all();
    return res.status(400).render('admin/lead-new', {
      page: 'admin-lead-new',
      clients,
      errors,
      values: req.body,
    });
  }

  const wholesaleCents = Math.round(wholesaleNum * 100);
  const resaleCents = Math.round(resaleNum * 100);

  const insertLead = db.prepare(`
    INSERT INTO leads (client_id, received_at, coverage_area, job_type, contact_name, contact_phone, contact_address, wholesale_cost_cents, resale_cost_cents, source, notes)
    VALUES (@client_id, @received_at, @coverage_area, @job_type, @contact_name, @contact_phone, @contact_address, @wholesale_cost_cents, @resale_cost_cents, @source, @notes)
  `);

  const tx = db.transaction(() => {
    const info = insertLead.run({
      client_id,
      received_at: received_at ? received_at.replace('T', ' ') + ':00' : new Date().toISOString().replace('T', ' ').slice(0, 19),
      coverage_area: coverage_area.trim(),
      job_type: job_type.trim(),
      contact_name: contact_name.trim(),
      contact_phone: contact_phone.trim(),
      contact_address: (contact_address || '').trim(),
      wholesale_cost_cents: wholesaleCents,
      resale_cost_cents: resaleCents,
      source: (source || '').trim(),
      notes: (notes || '').trim(),
    });
    const leadId = info.lastInsertRowid;
    db.prepare(
      `INSERT INTO transactions (client_id, lead_id, type, amount_cents, description)
       VALUES (?, ?, 'lead_charge', ?, ?)`
    ).run(client_id, leadId, resaleCents, `Lead charge - ${job_type.trim()} (${coverage_area.trim()})`);
    return leadId;
  });

  tx();

  res.redirect('/admin/leads');
});

// ---------- Clients ----------

router.get('/clients', (req, res) => {
  const clients = db.prepare('SELECT * FROM clients ORDER BY business_name').all();
  const leadCounts = db
    .prepare('SELECT client_id, COUNT(*) AS n FROM leads GROUP BY client_id')
    .all()
    .reduce((acc, row) => ((acc[row.client_id] = row.n), acc), {});
  res.render('admin/clients', { page: 'admin-clients', clients, leadCounts });
});

router.get('/clients/new', (req, res) => {
  res.render('admin/client-new', {
    page: 'admin-client-new',
    errors: null,
    values: {},
    createdCredentials: null,
  });
});

router.post('/clients/new', (req, res) => {
  const { business_name, contact_name, email, phone, coverage_area, bundle, username, notes } = req.body;

  const errors = [];
  if (!business_name || !business_name.trim()) errors.push('Business name is required.');
  if (!contact_name || !contact_name.trim()) errors.push('Contact name is required.');
  if (!email || !email.trim()) errors.push('Email is required.');
  if (!phone || !phone.trim()) errors.push('Phone is required.');
  if (!coverage_area || !coverage_area.trim()) errors.push('Coverage area is required.');
  if (!username || !username.trim()) errors.push('Username is required.');

  if (!errors.length) {
    const existing = db.prepare('SELECT id FROM clients WHERE username = ?').get(username.trim());
    if (existing) errors.push('That username is already taken.');
  }

  if (errors.length) {
    return res.status(400).render('admin/client-new', {
      page: 'admin-client-new',
      errors,
      values: req.body,
      createdCredentials: null,
    });
  }

  const password = generatePassword();
  const hash = bcrypt.hashSync(password, 12);

  const info = db
    .prepare(
      `INSERT INTO clients (username, password_hash, business_name, contact_name, email, phone, coverage_area, bundle, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      username.trim(),
      hash,
      business_name.trim(),
      contact_name.trim(),
      email.trim(),
      phone.trim(),
      coverage_area.trim(),
      bundle || 'starter',
      (notes || '').trim()
    );

  res.render('admin/client-new', {
    page: 'admin-client-new',
    errors: null,
    values: {},
    createdCredentials: {
      id: info.lastInsertRowid,
      business_name: business_name.trim(),
      username: username.trim(),
      password,
    },
  });
});

router.get('/clients/:id', (req, res) => {
  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id);
  if (!client) return res.redirect('/admin/clients');
  const leads = db.prepare('SELECT * FROM leads WHERE client_id = ? ORDER BY received_at DESC').all(client.id);
  const transactions = db
    .prepare('SELECT * FROM transactions WHERE client_id = ? ORDER BY created_at DESC')
    .all(client.id);
  res.render('admin/client-detail', { page: 'admin-client-detail', client, leads, transactions });
});

router.post('/clients/:id/status', (req, res) => {
  const { status } = req.body;
  if (['active', 'paused', 'canceled'].includes(status)) {
    db.prepare('UPDATE clients SET status = ? WHERE id = ?').run(status, req.params.id);
  }
  res.redirect('/admin/clients/' + req.params.id);
});

router.post('/clients/:id/reset-password', (req, res) => {
  const password = generatePassword();
  const hash = bcrypt.hashSync(password, 12);
  db.prepare('UPDATE clients SET password_hash = ? WHERE id = ?').run(hash, req.params.id);
  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id);
  const leads = db.prepare('SELECT * FROM leads WHERE client_id = ? ORDER BY received_at DESC').all(client.id);
  const transactions = db
    .prepare('SELECT * FROM transactions WHERE client_id = ? ORDER BY created_at DESC')
    .all(client.id);
  res.render('admin/client-detail', {
    page: 'admin-client-detail',
    client,
    leads,
    transactions,
    newPassword: password,
  });
});

// ---------- Interest submissions ----------

router.get('/interest', (req, res) => {
  const submissions = db.prepare('SELECT * FROM interest_submissions ORDER BY created_at DESC').all();
  res.render('admin/interest', { page: 'admin-interest', submissions });
});

router.post('/interest/:id/status', (req, res) => {
  const { status } = req.body;
  if (['new', 'contacted', 'converted', 'dismissed'].includes(status)) {
    db.prepare('UPDATE interest_submissions SET status = ? WHERE id = ?').run(status, req.params.id);
  }
  res.redirect('/admin/interest');
});

module.exports = router;
