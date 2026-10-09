import { search } from '../_shared/core.js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS'
};

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

  const url = new URL(request.url);
  const q = url.searchParams.get('q') || '';
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));

  try {
    const payload = await search(env, q, page);
    return new Response(JSON.stringify(payload, null, 2), {
      headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' }
    });
  } catch (e) {
    return new Response(JSON.stringify({ status: 'error', error: e.message }), {
      status: 502,
      headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' }
    });
  }
}