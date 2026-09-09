function money(cents) {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function dateTime(isoOrSqliteString) {
  if (!isoOrSqliteString) return '';
  // SQLite datetime('now') gives "YYYY-MM-DD HH:MM:SS" (UTC, no offset).
  // Normalize so JS parses it as UTC rather than local time.
  let s = isoOrSqliteString;
  if (!s.includes('T') && !s.endsWith('Z')) {
    s = s.replace(' ', 'T') + 'Z';
  }
  const d = new Date(s);
  if (isNaN(d.getTime())) return isoOrSqliteString;
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function timeAgo(isoOrSqliteString) {
  if (!isoOrSqliteString) return '';
  let s = isoOrSqliteString;
  if (!s.includes('T') && !s.endsWith('Z')) {
    s = s.replace(' ', 'T') + 'Z';
  }
  const d = new Date(s);
  if (isNaN(d.getTime())) return '';
  const diffMs = Date.now() - d.getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}

const BUNDLE_LABELS = {
  starter: 'Starter',
  crew: 'Crew',
  fleet: 'Fleet',
  unsure: 'Not sure yet',
};

module.exports = { money, dateTime, timeAgo, BUNDLE_LABELS };
