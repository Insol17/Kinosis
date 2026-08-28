import { imageUrl, json, tmdb } from '../lib/tmdb.mjs';
import { KINOSIS_LOCALE } from '../lib/locale.mjs';

const norm = (value) => String(value || '').normalize('NFKC').toLowerCase().replace(/[^a-z0-9가-힣]+/g, '');
const cache = new Map();

async function pool(items, size, fn) {
  const output = new Array(items.length); let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(size, Math.max(1, items.length)) }, async () => {
    while (cursor < items.length) { const index = cursor++; try { output[index] = await fn(items[index]); } catch { output[index] = null; } }
  }));
  return output;
}

async function profileFor(name) {
  const key = norm(name);
  const hit = cache.get(key);
  if (hit?.expiresAt > Date.now()) return hit.value;
  const search = await tmdb('/search/person', { query: name, language: KINOSIS_LOCALE.language, include_adult: false, page: 1 });
  const rows = search.results || [];
  const person = rows.sort((a, b) => {
    const score = (row) => (norm(row.name) === key ? 1200 : 0) + (row.known_for_department === 'Directing' ? 250 : 0) + Number(row.popularity || 0);
    return score(b) - score(a);
  })[0] || null;
  const value = person ? { name, personId: String(person.id), profileUrl: imageUrl(person.profile_path, 'w500') } : { name, personId: '', profileUrl: null };
  cache.set(key, { value, expiresAt: Date.now() + 7 * 86400000 });
  return value;
}

export default async (request) => {
  if (request.method !== 'GET') return json({ error: 'Method not allowed.' }, 405);
  const url = new URL(request.url);
  const names = [...new Set(String(url.searchParams.get('names') || '').split('|').map((name) => name.trim()).filter(Boolean))].slice(0, 25);
  if (!names.length) return json({ results: [] });
  try {
    const results = (await pool(names, 5, profileFor)).filter(Boolean);
    return json({ results }, 200, 'public, max-age=3600, stale-while-revalidate=86400', { 'Netlify-CDN-Cache-Control': 'public, durable, max-age=604800, stale-while-revalidate=2592000' });
  } catch (error) {
    console.error('director-profiles:', error.message);
    return json({ error: error.message || 'Director profiles failed.' }, error.status || 500);
  }
};

export const config = { path: '/api/director-profiles', method: 'GET', rateLimit: { action: 'rate_limit', aggregateBy: ['ip'], windowSize: 60, windowLimit: 30 } };
