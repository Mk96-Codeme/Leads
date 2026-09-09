-- DispatchLeads schema (SQLite)

CREATE TABLE IF NOT EXISTS admin_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Clients are created manually by the admin AFTER payment is confirmed
-- outside the app. There is no self-serve signup or password reset.
CREATE TABLE IF NOT EXISTS clients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  business_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  coverage_area TEXT NOT NULL,        -- free text, e.g. "Tampa Bay, FL (Pinellas/Hillsborough/Pasco)"
  bundle TEXT NOT NULL DEFAULT 'starter',  -- starter | crew | fleet
  status TEXT NOT NULL DEFAULT 'active',   -- active | paused | canceled
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Public interest form submissions land here. Admin reviews, follows up by
-- email with payment instructions, and only then creates a client record.
CREATE TABLE IF NOT EXISTS interest_submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  business_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  coverage_area TEXT NOT NULL,
  bundle_interest TEXT NOT NULL,      -- starter | crew | fleet | unsure
  message TEXT,
  status TEXT NOT NULL DEFAULT 'new', -- new | contacted | converted | dismissed
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Every lead the admin manually enters and assigns to a client.
CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES clients(id),
  received_at TEXT NOT NULL DEFAULT (datetime('now')), -- date/time lead came in
  coverage_area TEXT NOT NULL,
  job_type TEXT NOT NULL,             -- e.g. "Lockout - Residential", "Rekey", "Car Key Fob"
  contact_name TEXT NOT NULL,
  contact_phone TEXT NOT NULL,
  contact_address TEXT,
  wholesale_cost_cents INTEGER NOT NULL,  -- what the owner paid the source
  resale_cost_cents INTEGER NOT NULL,     -- what the client is charged
  source TEXT,                        -- e.g. "EchoLocal"
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Running activity/transaction log shown to each client. A row is created
-- automatically whenever a lead is assigned; the admin can also add
-- manual entries (credits, adjustments, notes).
CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES clients(id),
  lead_id INTEGER REFERENCES leads(id),
  type TEXT NOT NULL,                 -- lead_charge | adjustment | note
  amount_cents INTEGER NOT NULL DEFAULT 0,
  description TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_leads_client ON leads(client_id);
CREATE INDEX IF NOT EXISTS idx_transactions_client ON transactions(client_id);
