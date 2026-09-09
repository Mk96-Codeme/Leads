const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DATABASE_PATH = process.env.DATABASE_PATH || path.join(__dirname, 'dispatchleads.db');

// Make sure the directory for the db file exists (important on hosts where
// DATABASE_PATH points at a mounted volume like /data/dispatchleads.db)
const dir = path.dirname(DATABASE_PATH);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

const db = new Database(DATABASE_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Apply schema on every boot - all statements are CREATE TABLE IF NOT EXISTS,
// so this is safe to run repeatedly.
const schemaPath = path.join(__dirname, 'schema.sql');
const schema = fs.readFileSync(schemaPath, 'utf8');
db.exec(schema);

module.exports = db;
