// Push the locally-crawled Spider Search index into Cloudflare D1.
//
//   node scripts/push-index-to-d1.mjs
//
// Reads the local SQLite store produced by spider-index.mjs and writes rows to
// D1 through the Cloudflare REST API. Re-runnable: pages.url is the primary key,
// so re-pushing refreshes instead of duplicating.
//
// Credentials (never commit these - put them in a .env or export them):
//   CLOUDFLARE_ACCOUNT_ID   from dashboard -> Workers & Pages -> Account ID
//   CLOUDFLARE_API_TOKEN    Workers Scripts:Edit, D1:Edit, Account:Read
//   CLOUDFLARE_D1_DATABASE_ID  the UUID of the spidersearch database

import { DatabaseSync } from 'node:sqlite';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  const file = join(__dirname, '..', '.env');
  if (existsSync(file)) {
    for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
      }
    }
  }
}

const ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID;
const TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const DB_ID = process.env.CLOUDFLARE_D1_DATABASE_ID;
const LOCAL_DB =
  process.env.SPIDER_INDEX_PATH ||
  join(__dirname, '..', '..', '..', 'Downloads', 'spider-standalone', 'spider-standalone', 'spider-search', 'spider-index.db');

// D1 caps how many statements one API call can carry, so batch.
const BATCH = 50;

async function d1Query(statements) {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/d1/database/${DB_ID}/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ statements })
    }
  );
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.errors?.map((e) => e.message).join('; ') || `HTTP ${res.status}`);
  }
  return json;
}

async function main() {
  loadEnv();

  const missing = ['CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_D1_DATABASE_ID'].filter(
    (k) => !process.env[k]
  );
  if (missing.length) {
    console.error('Missing env vars: ' + missing.join(', '));
    console.error('Create a .env next to package.json:');
    console.error('  CLOUDFLARE_ACCOUNT_ID=...');
    console.error('  CLOUDFLARE_API_TOKEN=...');
    console.error('  CLOUDFLARE_D1_DATABASE_ID=...');
    process.exit(1);
  }

  if (!existsSync(LOCAL_DB)) {
    console.error('No local index at: ' + LOCAL_DB);
    console.error('Run spider-index.mjs crawl|repos first.');
    process.exit(1);
  }

  const local = new DatabaseSync(LOCAL_DB, { readOnly: true });
  const rows = local
    .prepare('SELECT url, host, title, body, fetched_at, crawl_depth FROM pages')
    .all();
  local.close();

  if (!rows.length) {
    console.log('Local index is empty - nothing to push.');
    return;
  }

  console.log(`Pushing ${rows.length} pages to D1 ...`);

  // D1 statements are per-row upserts. FTS is rebuilt from pages via triggers
  // in the SQL file if present, otherwise we write both explicitly.
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const statements = [];

    for (const r of chunk) {
      const title = r.title || '';
      const body = r.body || '';
      statements.push(
        `INSERT INTO pages (url, host, title, body, fetched_at, crawl_depth)
         VALUES (${q(r.url)}, ${q(r.host)}, ${q(title)}, ${q(body)}, ${r.fetched_at}, ${r.crawl_depth})
         ON CONFLICT(url) DO UPDATE SET
           title = excluded.title,
           body = excluded.body,
           fetched_at = excluded.fetched_at,
           crawl_depth = excluded.crawl_depth`
      );
      statements.push(`DELETE FROM pages_fts WHERE url = ${q(r.url)}`);
      statements.push(
        `INSERT INTO pages_fts (title, body, url) VALUES (${q(title)}, ${q(body)}, ${q(r.url)})`
      );
    }

    await d1Query(statements);
    process.stdout.write(`\r  ${Math.min(i + BATCH, rows.length)}/${rows.length}`);
  }

  console.log('\ndone.');
  console.log('Verify with:  npx.cmd wrangler d1 execute spidersearch --command "SELECT COUNT(*) FROM pages"');
}

function q(v) {
  if (v === null || v === undefined) return 'NULL';
  return "'" + String(v).replace(/'/g, "''") + "'";
}

main().catch((e) => {
  console.error('\n' + e.message);
  process.exit(1);
});