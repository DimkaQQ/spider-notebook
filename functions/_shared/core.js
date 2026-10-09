// Spider Search - shared ranking core for Cloudflare Pages Functions.
// Runs on the Workers runtime: no filesystem, no node:sqlite - the index
// lives in D1 (FTS5). Ranking rules are ported from spider_crawler.py.

export const ENDPOINT_BASE = ''; // same-origin

export const OWNED = {
  boost: 500,
  domains: ['m4spider.com', 'ai.m4spider.com', 'maps.m4spider.com', 'aistudio.m4spider.com'],
  urlPrefixes: ['https://github.com/M4SPIDER/'],
  githubRepos: ['M4SPIDER/spider-canvas']
};

const UA = 'SpiderSearch/3.0 (M4 Spider; +https://m4spider.com)';
const PER_PAGE = 20;
const TOTAL_PAGES = 20;

export const TRUSTED = [
  'github.com', 'docs.', 'developer.mozilla.org', 'wikipedia.org',
  'stackoverflow.com', 'arxiv.org', 'dev.to', 'medium.com'
];

// Domain priority: .com first, then X/Twitter, then Archive.org, Wikipedia, others
export function domainPriority(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    if (host.endsWith('.com')) return 0;
    if (host === 'x.com' || host === 'twitter.com') return 1;
    if (host === 'archive.org') return 2;
    if (host === 'wikipedia.org') return 3;
    return 4;
  } catch {
    return 4;
  }
}

export const stripTags = (s) =>
  (s || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export function isOwned(url) {
  let u;
  try { u = new URL(url); } catch { return false; }
  const host = u.hostname.replace(/^www\./, '');
  if (OWNED.domains.some((d) => host === d || host.endsWith('.' + d))) return true;
  if (OWNED.urlPrefixes.some((p) => u.toString().startsWith(p))) return true;
  return OWNED.githubRepos.some((r) => {
    const [owner, repo] = r.split('/');
    return u.hostname === 'github.com' && u.pathname.startsWith(`/${owner}/${repo}`);
  });
}

async function getJson(url, ms = 7000) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(ms) });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}
async function getText(url, ms = 7000) {
  const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(ms) });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.text();
}

/* ------------------------------ sources ------------------------------ */

async function searchWikipedia(q, limit) {
  try {
    const d = await getJson(
      `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&srlimit=${limit}&format=json`
    );
    return (d?.query?.search || []).map((it) => ({
      engine: 'wikipedia',
      title: it.title,
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(String(it.title).replace(/ /g, '_'))}`,
      snippet: stripTags(it.snippet),
      weight: 0.9
    }));
  } catch { return []; }
}

async function searchStackExchange(q, limit) {
  try {
    const d = await getJson(
      `https://api.stackexchange.com/2.3/search/advanced?order=desc&sort=relevance&q=${encodeURIComponent(q)}&site=stackoverflow&pagesize=${limit}`
    );
    return (d?.items || []).map((it) => ({
      engine: 'stackexchange',
      title: it.title,
      url: it.link,
      snippet: stripTags((it.body || '')).slice(0, 400),
      weight: 1.15
    }));
  } catch { return []; }
}

async function searchArxiv(q, limit) {
  try {
    const xml = await getText(`http://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(q)}&max_results=${limit}`);
    return xml.split('<entry>').slice(1).map((e) => {
      const title = stripTags((e.match(/<title>([\s\S]*?)<\/title>/) || [])[1]);
      const link = (e.match(/<id>([\s\S]*?)<\/id>/) || [])[1];
      const summary = stripTags((e.match(/<summary>([\s\S]*?)<\/summary>/) || [])[1]);
      return { engine: 'arxiv', title, url: (link || '').trim(), snippet: summary, weight: 1.05 };
    }).filter((r) => r.title && r.url);
  } catch { return []; }
}

async function searchHackerNews(q, limit) {
  try {
    const d = await getJson(`https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(q)}&hitsPerPage=${limit}&tags=story`);
    return (d?.hits || []).map((it) => ({
      engine: 'hn',
      title: it.title || it.story_title || 'Hacker News',
      url: it.url || `https://news.ycombinator.com/item?id=${it.objectID}`,
      snippet: stripTags(it.story_text || '').slice(0, 300),
      weight: 0.95
    }));
  } catch { return []; }
}

async function searchOpenAlex(q, limit) {
  try {
    const d = await getJson(`https://api.openalex.org/works?search=${encodeURIComponent(q)}&per-page=${limit}`);
    return (d?.results || []).map((it) => ({
      engine: 'openalex',
      title: it.display_name,
      url: it.doi ? `https://doi.org/${String(it.doi).replace(/^https?:\/\/doi\.org\//, '')}` : it.id,
      snippet: stripTags([it.publication_year, it.primary_location?.source?.display_name].filter(Boolean).join(' - ')),
      weight: 0.85
    }));
  } catch { return []; }
}

// DuckDuckGo is the PRIMARY source. It is the one non-official source here,
// so it is weighted highest and labelled in every response.
async function searchDuckDuckGo(q, limit) {
  try {
    const res = await fetch(`https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(q)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      signal: AbortSignal.timeout(6000)
    });
    if (!res.ok) return [];
    const html = await res.text();
    const links = [...html.matchAll(/<a[^>]*class=['"]result-link['"][^>]*>([\s\S]*?)<\/a>/g)];
    const snips = [...html.matchAll(/<td[^>]*class=['"]result-snippet['"][^>]*>([\s\S]*?)<\/td>/g)];
    return links.map((m, i) => {
      const tag = html.slice(m.index, m.index + m[0].length);
      const href = (tag.match(/href=['"]([^'"]+)['"]/) || [])[1];
      let url = '';
      if (href) {
        const u = href.startsWith('//') ? 'https:' + href : href;
        try {
          const p = new URL(u);
          url = p.searchParams.get('uddg') ? decodeURIComponent(p.searchParams.get('uddg')) : u;
        } catch { url = u; }
      }
      return { engine: 'duckduckgo', title: stripTags(m[1]), url, snippet: stripTags(snips[i] ? snips[i][1] : ''), weight: 1.5 };
    }).slice(0, limit);
  } catch { return []; }
}

/* ------------------------- our index (D1) ------------------------- */

async function searchOwnIndex(env, q, limit) {
  if (!env || !env.DB) return [];
  const terms = q.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 1).slice(0, 8);
  if (!terms.length) return [];
  // Use AND between terms for precision - all terms must be present
  const match = terms.map((t) => `"${t}"*`).join(' AND ');
  try {
    const { results } = await env.DB.prepare(
      `SELECT f.url AS url, f.title AS title,
              snippet(pages_fts, 1, '<b>', '</b>', '...', 24) AS snip,
              bm25(pages_fts, 8.0, 1.0) AS score
       FROM pages_fts f
       WHERE pages_fts MATCH ?
       ORDER BY score
       LIMIT ?`
    ).bind(match, limit).all();
    return (results || []).map((r) => ({
      engine: 'own-index',
      title: r.title || r.url,
      url: r.url,
      snippet: stripTags(r.snip || '').replace(/<\/?b>/g, ''),
      weight: Math.min(1.35, 1.0 + Math.abs(r.score) * 0.02)
    }));
  } catch { return []; }
}

export async function indexStats(env) {
  if (!env || !env.DB) return null;
  try {
    const { results } = await env.DB.prepare(
      'SELECT COUNT(*) AS pages, COUNT(DISTINCT host) AS hosts, MAX(fetched_at) AS newest FROM pages'
    ).all();
    return results && results[0]
      ? { pages: results[0].pages, hosts: results[0].hosts, newest: results[0].newest }
      : null;
  } catch { return null; }
}

/* ------------------------- aggregate + rank ------------------------- */

export async function search(env, query, page = 1) {
  const q = (query || '').trim();
  const empty = {
    status: 'success',
    mode: 'Cloudflare Pages + D1 (DuckDuckGo first, own index second)',
    provider: 'SpiderSearch',
    query: '', page, total_pages: TOTAL_PAGES,
    total_matches: 0, matches_on_page: 0, results: []
  };
  if (!q) return empty;

  const [ddg, wiki, se, ax, hn, oa, own] = await Promise.all([
    searchDuckDuckGo(q, 20), searchWikipedia(q, 10), searchStackExchange(q, 10),
    searchArxiv(q, 6), searchHackerNews(q, 8), searchOpenAlex(q, 6),
    searchOwnIndex(env, q, 12)
  ]);

  // DuckDuckGo leads, our own index sits right behind it
  const hits = [...ddg, ...own, ...wiki, ...se, ...ax, ...hn, ...oa];

  const map = new Map();
  for (const hit of hits) {
    const u = hit.url;
    if (!u || !u.startsWith('http')) continue;
    if (!map.has(u)) {
      map.set(u, { title: hit.title, url: u, snippet: hit.snippet, engines: [hit.engine], score: hit.weight * 10 });
    } else {
      const item = map.get(u);
      item.engines.push(hit.engine);
      item.score += 15; // cross-source agreement
      if ((hit.snippet || '').length > (item.snippet || '').length) item.snippet = hit.snippet;
    }
  }

  const qWords = (q.match(/\w+/g) || []).map((w) => w.toLowerCase()).filter((w) => w.length > 1);
  const ql = q.toLowerCase();

  const ranked = [];
  for (const [u, item] of map) {
    let score = item.score;
    const t = (item.title || '').toLowerCase();
    const s = (item.snippet || '').toLowerCase();
    if (t.includes(ql)) score += 50;  // exact phrase in title - much higher
    if (s.includes(ql)) score += 25;  // exact phrase in snippet
    for (const w of qWords) { if (t.includes(w)) score += 8; if (s.includes(w)) score += 3; }
    if (TRUSTED.some((d) => u.includes(d))) score += 10;

    // Domain priority boost: .com first, then X/Twitter, then Archive.org/Wikipedia
    const dp = domainPriority(u);
    if (dp === 0) score += 200;     // .com domains always first
    else if (dp === 1) score += 100; // X/Twitter second
    else if (dp === 2) score += 20;  // Archive.org third
    else if (dp === 3) score += 5;   // Wikipedia fourth
    // dp === 4 gets no bonus

    const owned = isOwned(u);
    if (owned) score += OWNED.boost;
    ranked.push({
      title: item.title, url: item.url, snippet: item.snippet,
      score: Math.round(score * 10) / 10,
      engines: [...new Set(item.engines)], owned
    });
  }
  ranked.sort((a, b) => b.score - a.score);

  const all = ranked.slice(0, PER_PAGE * 4);
  const start = (page - 1) * PER_PAGE;
  const slice = all.slice(start, start + PER_PAGE);

  return {
    status: 'success',
    mode: 'Cloudflare Pages + D1 (DuckDuckGo first, own index second)',
    provider: 'SpiderSearch',
    query: q, page, total_pages: TOTAL_PAGES,
    total_matches: all.length, matches_on_page: slice.length,
    results: slice,
    index: await indexStats(env)
  };
}

export async function suggest(q, localTerms = []) {
  const out = [];
  const seen = new Set();
  const ql = (q || '').toLowerCase();
  for (const t of localTerms) {
    if (t.toLowerCase().includes(ql) && !seen.has(t.toLowerCase())) {
      seen.add(t.toLowerCase()); out.push(t);
    }
  }
  if ((q || '').trim() && out.length < 8) {
    try {
      const d = await getJson(
        `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(q)}&limit=8&format=json`, 5000
      );
      for (const p of d?.[1] || []) {
        if (p && !seen.has(String(p).toLowerCase())) { seen.add(String(p).toLowerCase()); out.push(p); }
      }
    } catch {}
  }
  return out.slice(0, 8);
}