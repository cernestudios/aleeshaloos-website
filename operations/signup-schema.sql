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

