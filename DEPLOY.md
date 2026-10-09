# Deploying to Cloudflare Pages

## One-time setup

**1. Install deps**

```bash
npm install
```

**2. Create the D1 index database**

```bash
npx wrangler d1 create spidersearch
```

Copy the `database_id` it prints and paste it into `wrangler.toml`
(replacing `REPLACE_WITH_YOUR_D1_DATABASE_ID`).

**3. Create the schema**

```bash
npx wrangler d1 execute spidersearch --file=migrations/0001_init.sql
```

That creates the `pages` table and the `pages_fts` FTS5 virtual table.
Note: D1 requires **lowercase** `fts5` — `FTS5` is rejected.

## Connect a Pages project

Via the Cloudflare dashboard: **Workers & Pages → Create → Pages → Connect to Git**,
pick this repo, and use:

| Setting | Value |
|---|---|
| Framework preset | Vite |
| Build command | `npm run build` |
| Build output directory | `dist` |

Then **Settings → Functions → Bindings → Add** and bind:

| Variable | Value |
|---|---|
| `DB` | D1 database → `spidersearch` |

Without the `DB` binding, `/api/search` returns errors.

## How it fits together

```
functions/api/search.js      -> /api/search
functions/api/suggest.js    -> /api/suggest
functions/_shared/core.js   -> sources + ranking (your spider_crawler.py logic)
migrations/0001_init.sql    -> D1 schema (FTS5)
```

In production Cloudflare runs these on the Workers runtime. There is no
Node server and nothing listening on a port — `env.DB` is the index.

## Local development

The Pages Functions don't run under `vite dev`, so `vite.config.js` proxies
`/api/*` to the standalone Node relay:

```bash
# terminal 1 - the relay
cd <spider-standalone>/spider-search
node spider-search-server.mjs

# terminal 2 - the site
npm run dev
```

## Feeding the index

The crawler runs outside Cloudflare (it needs a real filesystem and long
lived connections). It writes to a local SQLite file, then you push rows into D1:

```bash
node spider-index.mjs repos M4SPIDER
node scripts/push-index-to-d1.mjs
```