const express = require('express');
const db = require('../db/connection');
const { requireClientAuth } = require('../middleware/auth');

const router = express.Router();

// Scoped to exactly the paths this router owns - this router is mounted at
// '/' in server.js alongside the public routes and the admin router, so a
// blanket router.use(requireClientAuth) here would intercept every
// unmatched request (including /admin/*) before it ever reached them.
router.use(['/dashboard', '/activity'], requireClientAuth);

router.get('/dashboard', (req, res) => {
  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.session.clientId);
  const leads = db.prepare('SELECT * FROM leads WHERE client_id = ? ORDER BY received_at DESC').all(client.id);

  const totalLeads = leads.length;
  const totalSpendCents = leads.reduce((sum, l) => sum + l.resale_cost_cents, 0);
  const last30 = leads.filter((l) => {
    const d = new Date((l.received_at || '').replace(' ', 'T') + 'Z');
    return Date.now() - d.getTime() <= 30 * 24 * 3600 * 1000;
  });

  res.render('client/dashboard', {
    page: 'client-dashboard',
    client,
    leads,
    totalLeads,
    totalSpendCents,
    last30Count: last30.length,
  });
});

router.get('/activity', (req, res) => {
  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.session.clientId);
  const transactions = db
    .prepare('SELECT * FROM transactions WHERE client_id = ? ORDER BY created_at DESC')
    .all(client.id);

  const balanceCents = transactions.reduce((sum, t) => sum + t.amount_cents, 0);

  res.render('client/activity', {
    page: 'client-activity',
    client,
    transactions,
    balanceCents,
  });
});

module.exports = router;
