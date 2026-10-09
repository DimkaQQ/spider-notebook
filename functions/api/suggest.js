import { suggest } from '../_shared/core.js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS'
};

export async function onRequest(context) {
  const { request } = context;
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

  const url = new URL(request.url);
  const q = url.searchParams.get('q') || '';
  const local = (url.searchParams.get('local') || '').split('|').map((s) => s.trim()).filter(Boolean);

  try {
    const items = await suggest(q, local);
    return new Response(JSON.stringify(items), {
      headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' }
    });
  } catch (e) {
    return new Response(JSON.stringify([]), {
      headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' }
    });
  }
}