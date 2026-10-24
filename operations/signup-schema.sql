CREATE TABLE IF NOT EXISTS signup_requests (
  id TEXT PRIMARY KEY, email TEXT NOT NULL, name TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL CHECK(source IN ('wobble','halloween')),
  updates INTEGER NOT NULL DEFAULT 0, consent_version TEXT NOT NULL,
  created_at TEXT NOT NULL, ip_hash TEXT, status TEXT NOT NULL,
  digest_id TEXT
);
CREATE INDEX IF NOT EXISTS signup_rate ON signup_requests(ip_hash,created_at);
CREATE INDEX IF NOT EXISTS signup_digest ON signup_requests(status,digest_id);
CREATE TABLE IF NOT EXISTS signup_digests (
  id TEXT PRIMARY KEY, created_at TEXT NOT NULL, status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS enquiries (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  message TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'website',
  created_at TEXT NOT NULL,
  status TEXT NOT NULL,
  notion_contact_id TEXT,
  notion_opportunity_id TEXT,
  notion_task_id TEXT,
  synced_at TEXT,
  sync_error TEXT
);
CREATE INDEX IF NOT EXISTS enquiries_pending ON enquiries(status, synced_at, created_at);
