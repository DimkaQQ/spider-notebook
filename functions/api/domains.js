import { FAMOUS_PATTERNS, BRAND_DOMAINS } from '../_shared/core.js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS'
};

// Exposes the ranking configuration so the UI can display it verbatim.
// No limit, no truncation - every configured domain is returned.
export async function onRequest(context) {
  const { request } = context;
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

  // "*.example.com" -> display form; group by brand where mapped
  const famous = [...new Set(FAMOUS_PATTERNS)].sort();

  const brands = {};
  for (const [brand, domains] of Object.entries(BRAND_DOMAINS)) {
    brands[brand] = domains;
  }

  return new Response(
    JSON.stringify(
      {
        famousPatterns: famous,
        famousCount: famous.length,
        brands
      },
      null,
      2
    ),
    { headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' } }
  );
}