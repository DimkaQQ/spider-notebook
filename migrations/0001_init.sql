-- Spider Search index on Cloudflare D1
-- Apply with:  npx wrangler d1 execute spidersearch --file=migrations/0001_init.sql

CREATE TABLE IF NOT EXISTS pages (
  url          TEXT PRIMARY KEY,
  host         TEXT NOT NULL,
  title        TEXT,
  body         TEXT,
  fetched_at   INTEGER NOT NULL,
  crawl_depth  INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_pages_host ON pages(host);
CREATE INDEX IF NOT EXISTS idx_pages_fetched ON pages(fetched_at);

-- FTS5 is supported on D1. Note: use lowercase fts5, uppercase FTS5 is rejected.
CREATE VIRTUAL TABLE IF NOT EXISTS pages_fts USING fts5(
  title,
  body,
  url UNINDEXED
);