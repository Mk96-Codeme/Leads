// Seeds an admin login and some demo data so you can click through the app
// locally before any real clients or leads exist.
//
// Run with: npm run seed
//
// Safe to re-run: it skips creating rows that already exist (matched by
// username). To wipe everything and start over, just delete the .db file
// and re-run this script.

require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('../db/connection');

function upsertAdmin(username, password) {
  const existing = db.prepare('SELECT id FROM admin_users WHERE username = ?').get(username);
  if (existing) {
    console.log(`Admin user "${username}" already exists, skipping.`);
    return;
  }
  const hash = bcrypt.hashSync(password, 12);
  db.prepare('INSERT INTO admin_users (username, password_hash) VALUES (?, ?)').run(username, hash);
  console.log(`Created admin user "${username}".`);
}

function upsertClient(c) {
  const existing = db.prepare('SELECT id FROM clients WHERE username = ?').get(c.username);
  if (existing) {
    console.log(`Client "${c.username}" already exists, skipping.`);
    return existing.id;
  }
  const hash = bcrypt.hashSync(c.password, 12);
  const info = db.prepare(`
    INSERT INTO clients (username, password_hash, business_name, contact_name, email, phone, coverage_area, bundle, status)
    VALUES (@username, @password_hash, @business_name, @contact_name, @email, @phone, @coverage_area, @bundle, 'active')
  `).run({ ...c, password_hash: hash });
  console.log(`Created client "${c.username}" (${c.business_name}).`);
  return info.lastInsertRowid;
}

function addLead(clientId, lead) {
  const info = db.prepare(`
    INSERT INTO leads (client_id, received_at, coverage_area, job_type, contact_name, contact_phone, contact_address, wholesale_cost_cents, resale_cost_cents, source, notes)
    VALUES (@client_id, @received_at, @coverage_area, @job_type, @contact_name, @contact_phone, @contact_address, @wholesale_cost_cents, @resale_cost_cents, @source, @notes)
  `).run({ client_id: clientId, ...lead });
  const leadId = info.lastInsertRowid;
  db.prepare(`
    INSERT INTO transactions (client_id, lead_id, type, amount_cents, description)
    VALUES (?, ?, 'lead_charge', ?, ?)
  `).run(clientId, leadId, lead.resale_cost_cents, `Lead charge - ${lead.job_type} (${lead.coverage_area})`);
}

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'change-me-immediately';
upsertAdmin(ADMIN_USERNAME, ADMIN_PASSWORD);

const demoClientId = upsertClient({
  username: 'demo',
  password: 'demo1234',
  business_name: 'Bayside Lock & Key',
  contact_name: 'Marcus Rivera',
  email: 'marcus@baysidelockkey.com',
  phone: '(727) 555-0142',
  coverage_area: 'Tampa Bay, FL (Pinellas / Hillsborough / Pasco)',
  bundle: 'crew',
});

if (demoClientId) {
  const now = Date.now();
  const hoursAgo = (h) => new Date(now - h * 3600 * 1000).toISOString();

  addLead(demoClientId, {
    received_at: hoursAgo(2),
    coverage_area: 'Clearwater, FL',
    job_type: 'Residential Lockout',
    contact_name: 'Diane Foss',
    contact_phone: '(727) 555-9981',
    contact_address: '412 Osceola Ave, Clearwater, FL',
    wholesale_cost_cents: 1800,
    resale_cost_cents: 3200,
    source: 'EchoLocal',
    notes: 'Locked out on porch, has ID, wants same-day.',
  });

  addLead(demoClientId, {
    received_at: hoursAgo(9),
    coverage_area: 'St. Petersburg, FL',
    job_type: 'Car Key Fob Programming',
    contact_name: 'Rob Nassar',
    contact_phone: '(813) 555-2207',
    contact_address: '900 4th St N, St. Petersburg, FL',
    wholesale_cost_cents: 2400,
    resale_cost_cents: 4100,
    source: 'EchoLocal',
    notes: '2021 Honda Civic, needs 1 spare fob cut + programmed.',
  });

  addLead(demoClientId, {
    received_at: hoursAgo(27),
    coverage_area: 'Tampa, FL',
    job_type: 'Commercial Rekey',
    contact_name: 'Priya Anand',
    contact_phone: '(813) 555-7734',
    contact_address: '2200 N Westshore Blvd, Tampa, FL',
    wholesale_cost_cents: 3000,
    resale_cost_cents: 5500,
    source: 'EchoLocal',
    notes: '6-door office suite, rekey after tenant turnover.',
  });

  addLead(demoClientId, {
    received_at: hoursAgo(51),
    coverage_area: 'New Port Richey, FL',
    job_type: 'Deadbolt Installation',
    contact_name: 'Tom Whitfield',
    contact_phone: '(727) 555-4410',
    contact_address: '7715 Grand Blvd, New Port Richey, FL',
    wholesale_cost_cents: 1500,
    resale_cost_cents: 2800,
    source: 'EchoLocal',
    notes: 'Supply + install, homeowner has hardware preference.',
  });
}

// A couple of raw interest-form submissions the admin hasn't actioned yet.
const existingInterest = db.prepare('SELECT COUNT(*) AS n FROM interest_submissions').get();
if (existingInterest.n === 0) {
  db.prepare(`
    INSERT INTO interest_submissions (name, business_name, email, phone, coverage_area, bundle_interest, message)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    'Jason Alvarez',
    'Alvarez Locksmith Co.',
    'jason@alvarezlocksmith.com',
    '(214) 555-3390',
    'Dallas-Fort Worth, TX',
    'crew',
    'Two vans on the road, looking to fill 15-20 jobs/week.'
  );
  db.prepare(`
    INSERT INTO interest_submissions (name, business_name, email, phone, coverage_area, bundle_interest, message)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    'Keisha Brown',
    'Brown\'s Mobile Locksmith',
    'keisha.brown@gmail.com',
    '(404) 555-6621',
    'Atlanta metro, GA',
    'starter',
    'Solo operator, just getting started with lead services.'
  );
  console.log('Added 2 demo interest submissions.');
}

console.log('\nSeed complete.');
console.log(`Admin login -> username: ${ADMIN_USERNAME}  password: ${ADMIN_PASSWORD}`);
console.log('Demo client login -> username: demo  password: demo1234');
