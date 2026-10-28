import React, { useState, useCallback, useEffect, useRef } from 'react';
import { ChevronLeft, Search as SearchIcon, AlertTriangle, Loader2 } from 'lucide-react';
import LivingBackground from './LivingBackground';

// same-origin Cloudflare Pages Functions (/api/*) - works in local dev too via vite proxy
const ENDPOINT = '/api/search';
const SUGGEST = '/api/suggest';

/* local terms that rank first in suggestions */
const LOCAL_TERMS = [
  'M4 Spider Notebook',
  'M4 Spider Notebook AI Agent',
  'Spider Maps',
  'Spider AI',
  'Spy Engine',
  'Spy Language',
  'Spider OS',
  'Spider Store',
  'Spider Cloud',
  'Spider VFX',
  'Spider Chip',
  'Spider Search',
  'Spider Browser'
];

/* Site theme tokens, taken from App.jsx CyberStyles */
const SITE = {
  accent: '#00F2FE',
  glass: 'rgba(3, 10, 18, 0.92)',
  premium:
    'linear-gradient(135deg, rgba(4, 18, 31, 0.95) 0%, rgba(2, 6, 12, 0.98) 100%)'
};

function Wordmark({ className = '' }) {
  return (
    <span className={`font-extrabold tracking-tight ${className}`}>
      <span className="text-white">SPIDER</span>{' '}
      <span className="text-cyan-400 text-glow-turquoise">SEARCH</span>
    </span>
  );
}

export default function SpiderSearch({ onBack = () => {} }) {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Important domains list
  const [open, setOpen] = useState(false);
  const [cfg, setCfg] = useState(null);
  const [domainsLoading, setDomainsLoading] = useState(true);
  const [domainsError, setDomainsError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/domains')
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) { setCfg(d); setDomainsLoading(false); }
      })
      .catch((e) => {
        if (!cancelled) { setDomainsError(e.message); setDomainsLoading(false); }
      });
    return () => { cancelled = true; };
  }, []);

  const famous = cfg ? cfg.famousPatterns : [];
  const brands = cfg ? cfg.brands : {};
  const brandNames = Object.keys(brands);
const [submitted, setSubmitted] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [activeSuggest, setActiveSuggest] = useState(-1);
  const [history, setHistory] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('spider-search-history') || '[]');
    } catch {
      return [];
    }
  });
  const suggestRef = useRef(null);

  /* always drop below the field, clamped to the space that remains */
  const [dropMaxH, setDropMaxH] = useState(320);
  const updateDropPos = () => {
    const el = suggestRef.current;
    if (!el) return;
    // anchor to the input itself, not the wrapper (which also wraps the buttons)
    const anchor = el.querySelector('input') || el;
    const rect = anchor.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - 20;
    setDropMaxH(Math.max(140, Math.min(420, spaceBelow)));
  };

  /* close the dropdown on outside click */
  useEffect(() => {
    const onDown = (e) => {
      // never close on a press that lands inside the field or the list
      if (suggestRef.current && suggestRef.current.contains(e.target)) return;
      if (e.target.closest && e.target.closest('[role="listbox"]')) return;
      setSuggestOpen(false);
    };
    const onResize = () => {
      if (suggestOpen) updateDropPos();
    };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('resize', onResize);
    };
  }, [suggestOpen]);

  /* debounced suggestions */
  useEffect(() => {
    const term = query.trim();
    if (!term) {
      setSuggestions([]);
      return;
    }
    const id = setTimeout(async () => {
      try {
        const terms = [...new Set([...history, ...LOCAL_TERMS])].slice(0, 25);
        const res = await fetch(
          `${SUGGEST}?q=${encodeURIComponent(term)}&local=${encodeURIComponent(terms.join('|'))}`
        );
        if (res.ok) {
          setSuggestions(await res.json());
          requestAnimationFrame(updateDropPos);
          // re-measure after the hero page-fade-in (0.5s) settles
          setTimeout(updateDropPos, 560);
        }
      } catch {
        setSuggestions([]);
      }
    }, 160);
    return () => clearTimeout(id);
  }, [query, history]);

  /* site keyframes + classes, scoped so the overlay animates identically */
  useEffect(() => {
    const style = document.createElement('style');
    style.dataset.spidersearch = '1';
    style.textContent = `
      @keyframes pulseSoft {
        0%, 100% { opacity: 0.25; filter: drop-shadow(0 0 2px rgba(0, 242, 254, 0.2)); }
        50% { opacity: 0.6; filter: drop-shadow(0 0 12px rgba(0, 242, 254, 0.8)); }
      }
      @keyframes neonGlowTeal {
        0%, 100% { box-shadow: 0 0 15px rgba(0, 242, 254, 0.15), inset 0 0 10px rgba(0, 242, 254, 0.05); }
        50% { box-shadow: 0 0 25px rgba(0, 242, 254, 0.35), inset 0 0 15px rgba(0, 242, 254, 0.1); }
      }
      @keyframes pageFadeIn {
        from { opacity: 0; transform: translateY(12px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes resultIn {
        from { opacity: 0; transform: translateY(12px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .page-fade-in { animation: pageFadeIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
      .result-in { animation: resultIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) both; }
      .neon-border-teal { border: 1px solid rgba(0, 242, 254, 0.3); animation: neonGlowTeal 6s infinite ease-in-out; }
      .text-glow-turquoise { text-shadow: 0 0 10px rgba(0, 242, 254, 0.5); }
      .glass-morphism { background: rgba(3, 10, 18, 0.92); border: 1px solid rgba(255, 255, 255, 0.05); }
      .glass-premium { background: linear-gradient(135deg, rgba(4,18,31,0.95) 0%, rgba(2,6,12,0.98) 100%); border: 1px solid rgba(0, 242, 254, 0.15); }
      .ss-dot { animation: pulseSoft 4s infinite ease-in-out; }
      .ss-back { animation: pulseSoft 5s infinite ease-in-out; }
      .premium-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
      .premium-scrollbar::-webkit-scrollbar-track { background: rgba(2, 6, 12, 0.5); }
      .premium-scrollbar::-webkit-scrollbar-thumb { background: rgba(0, 242, 254, 0.35); border-radius: 4px; }
      .premium-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(0, 242, 254, 0.75); }
      .scrolled-nav {
        background: rgba(3, 10, 18, 0.95);
        border-bottom: 1px solid rgba(0, 242, 254, 0.2);
        padding-top: 0.5rem;
        padding-bottom: 0.5rem;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
      }
    `;
    document.head.appendChild(style);
    return () => style.remove();
  }, []);

  const runSearch = useCallback(async (q, p = 1) => {
    const term = (q ?? '').trim();
    if (!term) {
      setData(null);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${ENDPOINT}?q=${encodeURIComponent(term)}&page=${p}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
      setPage(p);
      setSubmitted(term);
    } catch (e) {
      setData(null);
      setError(e.message === 'Failed to fetch' ? 'offline' : e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown' && suggestRows.length) {
      e.preventDefault();
      setActiveSuggest((i) => (i + 1) % suggestRows.length);
      return;
    }
    if (e.key === 'ArrowUp' && suggestRows.length) {
      e.preventDefault();
      setActiveSuggest((i) => (i <= 0 ? suggestRows.length - 1 : i - 1));
      return;
    }
    if (e.key === 'Escape') {
      setSuggestOpen(false);
      return;
    }
    if (e.key === 'Enter') {
      const pick = activeSuggest >= 0 ? suggestRows[activeSuggest].phrase : query;
      setSuggestOpen(false);
      setActiveSuggest(-1);
      runSearch(pick, 1);
      try {
        const term = (pick || '').trim();
        if (term) {
          const next = [term, ...history.filter((h) => h.toLowerCase() !== term.toLowerCase())].slice(0, 8);
          setHistory(next);
          localStorage.setItem('spider-search-history', JSON.stringify(next));
        }
      } catch { /* storage unavailable */ }
    }
  };

  const pickSuggestion = (s) => {
    setQuery(s);
    setSuggestOpen(false);
    setActiveSuggest(-1);
    runSearch(s, 1);
  };

  /* dropdown rows, shaped like Chrome's omnibox:
     [ "query - Spider Search", entity rows w/ thumbnail, plain query rows ] */
  /* M4 Spider entities pinned to the top, web queries fill what's left */
  const MAX_ENTITIES = 3;
  const entityRows = [];
  const queryRows = [];
  for (const s of suggestions) {
    const local = LOCAL_TERMS.find((t) => t.toLowerCase() === s.toLowerCase());
    const recent = history.find((h) => h.toLowerCase() === s.toLowerCase());
    if (local && entityRows.length < MAX_ENTITIES) {
      entityRows.push({
        type: 'entity',
        phrase: s,
        sub: 'M4 Spider Platform',
        initial: local[0].toUpperCase()
      });
    } else if (local) {
      queryRows.push({ type: 'query', phrase: s, sub: 'M4 Spider', initial: null });
    } else if (recent) {
      queryRows.push({ type: 'query', phrase: s, sub: 'Recent search', initial: null });
    } else {
      queryRows.push({ type: 'query', phrase: s, sub: '', initial: null });
    }
  }

  const suggestRows = [
    ...(query.trim()
      ? [{ type: 'search', phrase: query.trim(), sub: 'Spider Search', initial: null }]
      : []),
    ...entityRows,
    ...queryRows
  ].slice(0, 10);

  const dropdown = suggestOpen && suggestRows.length > 0 && (
    <ul
      className="absolute left-0 right-0 top-full mt-3 z-30 rounded-2xl overflow-hidden border border-slate-700/80 bg-[#0c1622] shadow-[0_24px_64px_rgba(0,0,0,.85)] py-1.5 overflow-y-auto premium-scrollbar"
      style={{ maxHeight: dropMaxH }}
      role="listbox"
    >
      {suggestRows.map((row, i) => (
        <li key={row.type + row.phrase} role="option" aria-selected={i === activeSuggest}>
          <button
            onMouseEnter={() => setActiveSuggest(i)}
            onClick={() => pickSuggestion(row.phrase)}
            className={`w-full text-left px-4 py-2.5 flex items-center gap-3.5 transition-colors ${
              i === activeSuggest ? 'bg-cyan-500/10' : 'hover:bg-white/[.04]'
            }`}
          >
            {row.type === 'entity' ? (
              <span className="w-9 h-9 rounded-lg shrink-0 bg-gradient-to-br from-cyan-500/30 to-teal-500/10 border border-cyan-500/40 flex items-center justify-center font-mono text-sm font-bold text-cyan-200">
                {row.initial}
              </span>
            ) : (
              <span className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center bg-white/[.06]">
                <SearchIcon className="w-4 h-4 text-slate-300" />
              </span>
            )}

            <span className="min-w-0 flex-1">
              <span
                className={`block truncate text-[15px] leading-tight ${
                  row.type === 'search'
                    ? 'text-cyan-300'
                    : row.type === 'entity'
                    ? 'text-white font-semibold'
                    : 'text-slate-200'
                }`}
              >
                {row.phrase}
              </span>
              {row.sub && (
                <span className="block truncate text-[12px] text-slate-400 leading-tight mt-0.5">
                  {row.sub}
                </span>
              )}
            </span>

            {i === activeSuggest && (
              <span className="font-mono text-[10px] text-slate-500 tracking-widest shrink-0">
                ENTER
              </span>
            )}
          </button>
        </li>
      ))}
    </ul>
  );

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [page]);

  /* scrolled-nav, same behaviour as the main site header */
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const results = (data && data.results) || [];
  const totalMatches = data ? data.total_matches : 0;
  const totalPages = data ? data.total_pages : 1;
  const hasResults = !!data && !error;

  const field =
    'w-full flex items-center gap-3 rounded-full bg-[#030a12]/80 border border-slate-800 hover:border-cyan-500/40 focus-within:border-cyan-400 transition-colors px-5 h-12';

  return (
    <div className="min-h-screen bg-[#05070a] text-slate-300 font-sans premium-scrollbar">
      {/* living motherboard background, same canvas as the main site */}
      <LivingBackground />

      {/* content sits above the canvas */}
      <div className="relative z-10">
      {/* ================= HEADER ================= */}
      <header
        className={`sticky top-0 z-20 backdrop-blur-md border-b transition-all duration-300 ${
          scrolled ? 'scrolled-nav' : 'glass-morphism border-cyan-500/15'
        }`}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-4">
          <button
            onClick={onBack}
            className="ss-back shrink-0 w-9 h-9 rounded-lg border border-cyan-500/30 hover:bg-cyan-500/10 flex items-center justify-center transition-colors"
            aria-label="Back to products"
            title="Back to products"
          >
            <ChevronLeft className="w-4 h-4 text-cyan-400" />
          </button>

          <span className="hidden sm:block shrink-0">
            <Wordmark className="text-[18px]" />
          </span>

          <div className="flex-1 flex justify-center">
            {submitted ? (
              <div className="w-full max-w-[600px] relative" ref={suggestRef}>
                <div className="flex items-center gap-3 glass-premium rounded-full px-4 h-10">
                  <SearchIcon className="w-4 h-4 text-cyan-400/70 shrink-0" />
                  <input
                    value={query}
                    onChange={(e) => { setQuery(e.target.value); setSuggestOpen(true); }}
                    onFocus={() => { setSuggestOpen(true); updateDropPos(); }}
                    onKeyDown={onKeyDown}
                    className="flex-1 bg-transparent outline-none text-sm text-slate-100 placeholder-slate-500 font-sans"
                    placeholder="Search Spider"
                  />
                  {loading && <Loader2 className="w-4 h-4 text-cyan-400 animate-spin shrink-0" />}
                </div>
                {dropdown}
              </div>
            ) : (
              /* idle: only the hero box is shown, so there is no duplicate */
              <span className="hidden sm:block text-[10px] font-mono tracking-[3px] text-slate-600 uppercase">
                M4 SPIDER
              </span>
            )}
          </div>

          <div className="hidden md:flex items-center gap-3 shrink-0">
            <span className="flex items-center gap-1.5 font-mono text-[10px] tracking-widest text-emerald-400 uppercase">
              <span className="ss-dot w-1.5 h-1.5 rounded-full bg-emerald-400" /> Live
            </span>
            <span className="w-8 h-8 rounded-lg border border-cyan-500/30 bg-[#030e18] flex items-center justify-center font-mono text-[10px] font-bold text-cyan-400">
              M4
            </span>
          </div>
        </div>
      </header>

      {/* ================= CONTENT ================= */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 pb-16">
        {/* idle hero */}
        {!hasResults && !error && !submitted && (
          <div className="min-h-[72vh] page-fade-in flex flex-col items-center justify-center gap-7">
            <Wordmark className="text-[40px] sm:text-[56px]" />

            <div className="w-full max-w-[560px] space-y-5 relative" ref={suggestRef}>
              <div className={`${field} neon-border-teal`}>
                <SearchIcon className="w-4 h-4 text-cyan-400/70 shrink-0" />
                <input
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setSuggestOpen(true); }}
                  onFocus={() => { setSuggestOpen(true); updateDropPos(); }}
                  onKeyDown={onKeyDown}
                  autoFocus
                  className="flex-1 bg-transparent outline-none text-sm text-slate-100 placeholder-slate-500 font-sans"
                  placeholder="Search Spider"
                />
              </div>
              {dropdown}

              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => runSearch(query, 1)}
                  className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-cyan-400 to-teal-400 text-slate-950 font-bold font-mono text-[11px] tracking-widest hover:opacity-90 transition-opacity"
                >
                  SPIDER SEARCH
                </button>
                <button
                  onClick={() => { if (results.length) window.open(results[0].url, '_blank', 'noopener'); }}
                  className="px-5 py-2.5 rounded-lg border border-slate-800 text-slate-400 hover:text-white hover:border-cyan-500/40 font-mono text-[11px] tracking-widest transition-colors"
                >
                  FEELING LUCKY
                </button>
              </div>
            </div>
          </div>
        )}

        {/* offline */}
        {error && (
          <div className="mt-20 rounded-2xl glass-premium border-amber-500/30 p-5 page-fade-in">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span className="text-sm font-bold text-white font-mono">
                {error === 'offline' ? 'SPIDER SEARCH DAEMON NOT REACHABLE' : `SEARCH FAILED: ${error}`}
              </span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed font-mono">
              Expected <span className="text-cyan-400">{ENDPOINT}</span>. Start it with{' '}
              <span className="text-cyan-400">node spider-search-server.mjs</span>, then search again.
            </p>
          </div>
        )}

        {/* results */}
        {hasResults && (
          <div className="page-fade-in pt-6">
            {/* stats */}
            <div className="flex items-center justify-between font-mono text-[10px] tracking-widest text-slate-500 uppercase pb-3 mb-5 border-b border-slate-900">
              <span>
                {totalMatches} matches · page {data.page}/{totalPages}
              </span>
              <span className="hidden sm:inline">{data.mode}</span>
            </div>

            {results.length === 0 ? (
              <p className="text-sm text-slate-400 font-mono">
                NO DOCUMENTS MATCHED “{data.query}”
              </p>
            ) : (
              <ol className="space-y-5">
                {results.map((r, i) => (
                  <li
                    key={i}
                    className="result-in glass-morphism rounded-xl p-4 transition-all duration-300 hover:border-cyan-500/40 hover:shadow-[0_0_20px_rgba(0,242,254,0.12)] hover:bg-[#040f1c]"
                    style={{ animationDelay: `${i * 45}ms` }}
                  >
                    {/* breadcrumb */}
                    <div className="flex items-center gap-2 mb-1.5 font-mono text-[11px] text-slate-500">
                      {(() => {
                        try {
                          const u = new URL(r.url);
                          return (
                            <>
                              <span className="w-5 h-5 rounded border border-cyan-500/20 bg-[#030e18] flex items-center justify-center text-[10px] font-bold text-cyan-400 shrink-0">
                                {u.hostname.replace(/^www\./, '')[0].toUpperCase()}
                              </span>
                              <span className="text-slate-400 truncate">{u.hostname.replace(/^www\./, '')}</span>
                              <span className="hidden sm:inline truncate">
                                {u.pathname === '/' ? '' : u.pathname}
                              </span>
                            </>
                          );
                        } catch {
                          return <span className="truncate">{(r.url || '').slice(0, 60)}</span>;
                        }
                      })()}
                    </div>

                    <a
                      href={r.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-base font-bold font-mono text-white hover:text-cyan-400 transition-colors"
                    >
                      {r.title}
                    </a>

                    {r.snippet && (
                      <p className="mt-2 text-[13px] leading-relaxed text-slate-400 font-sans">
                        {r.snippet}
                      </p>
                    )}
                  </li>
                ))}
              </ol>
            )}

            {/* pagination */}
            {totalPages > 1 && (
              <div className="mt-10 pt-6 border-t border-slate-900">
                <div className="flex items-center justify-center gap-1 font-mono text-xs">
                  <button
                    onClick={() => runSearch(submitted, Math.max(1, page - 1))}
                    disabled={page <= 1 || loading}
                    className="px-3 py-2 text-cyan-400 hover:text-cyan-300 disabled:text-slate-700 transition-colors"
                    aria-label="Previous page"
                  >
                    PREV
                  </button>

                  {Array.from({ length: Math.min(10, totalPages) }, (_, i) => i + 1).map((n) => (
                    <button
                      key={n}
                      onClick={() => runSearch(submitted, n)}
                      disabled={loading}
                      className={`w-9 h-9 rounded-lg transition-all duration-300 ${
                        n === page
                          ? 'bg-gradient-to-r from-cyan-400 to-teal-400 text-slate-950 font-bold'
                          : 'text-cyan-400 hover:bg-cyan-500/10 border border-transparent hover:border-cyan-500/30'
                      }`}
                    >
                      {n}
                    </button>
                  ))}

                  {totalPages > 10 && <span className="px-2 text-slate-600">…</span>}

                  <button
                    onClick={() => runSearch(submitted, Math.min(totalPages, page + 1))}
                    disabled={page >= totalPages || loading}
                    className="px-3 py-2 text-cyan-400 hover:text-cyan-300 disabled:text-slate-700 transition-colors"
                    aria-label="Next page"
                  >
                    NEXT
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* ================= FOOTER ================= */}
      {hasResults && (
        <footer className="border-t border-slate-900 bg-[#020509]">
          <div className="max-w-3xl mx-auto px-6 py-5 flex flex-wrap items-center justify-between gap-2 font-mono text-[10px] tracking-widest text-slate-600 uppercase">
            <span>M4 SPIDER TECHNOLOGIES · SPIDER SEARCH</span>
            <span>Official APIs + own index</span>
          </div>
        </footer>
      )}

      {/* ============ IMPORTANT DOMAINS ============ */}
      <div className="border-t border-slate-900 bg-[#020509]">
        <div className="max-w-3xl mx-auto px-6 py-8">
          <details className="group">
            <summary className="flex items-center justify-between cursor-pointer list-none">
              <div>
                <h3 className="font-mono text-xs font-bold tracking-widest text-slate-400 uppercase">
                  Important Domains
                </h3>
                <p className="text-[11px] text-slate-600 mt-1 font-mono">
                  Which domains outrank everything else
                </p>
              </div>
              <span className="font-mono text-slate-500 group-open:hidden">+</span>
              <span className="font-mono text-slate-500 hidden group-open:inline">-</span>
            </summary>

            <div className="mt-6 space-y-6">
              {domainsLoading && (
                <p className="font-mono text-[11px] text-slate-500">loading domain list…</p>
              )}
              {domainsError && (
                <p className="font-mono text-[11px] text-amber-400">could not load: {domainsError}</p>
              )}

              {brandNames.length > 0 && (
                <div>
                  <h4 className="font-mono text-[10px] tracking-widest text-cyan-400 uppercase mb-3">
                    Brand search → only that brand's domains
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {brandNames.map((b) => (
                      <div
                        key={b}
                        className="rounded-lg border border-slate-800 bg-[#0b1622] px-2.5 py-2"
                      >
                        <div className="font-mono text-[10px] font-bold text-slate-200 truncate">
                          {b}
                        </div>
                        <div className="font-mono text-[9px] text-slate-500 truncate">
                          → {brands[b].join(', ')}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {famous.length > 0 && (
                <div>
                  <h4 className="font-mono text-[10px] tracking-widest text-cyan-400 uppercase mb-3">
                    Priority domains · {famous.length} total
                    <span className="text-slate-500 normal-case tracking-normal">
                      {' '}— *.example.com matches any subdomain
                    </span>
                  </h4>
                  <div className="rounded-lg border border-slate-800 bg-[#0b1622] p-4">
                    <div className="font-mono text-[11px] leading-[1.9] text-slate-300 break-all">
                      {famous.map((d, i) => (
                        <span key={d}>
                          <span className={d.startsWith('*.') ? 'text-cyan-300' : ''}>{d}</span>
                          {i < famous.length - 1 ? ', ' : ''}
                        </span>
                      ))}
                    </div>
                  </div>
                  <p className="mt-2 font-mono text-[10px] text-slate-600">
                    Showing all {famous.length} — no limit
                  </p>
                </div>
              )}
            </div>
          </details>
        </div>
      </div>
      </div>
    </div>
  );
}