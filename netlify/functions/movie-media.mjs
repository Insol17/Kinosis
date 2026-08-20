import { imageUrl, json, tmdb } from '../lib/tmdb.mjs';
import { KINOSIS_LOCALE } from '../lib/locale.mjs';

const TTL = 24 * 60 * 60 * 1000;
const cache = new Map();

function trailerScore(row) {
  let score = 0;
  if (row.official) score += 50;
  if (row.type === 'Trailer') score += 40;
  else if (row.type === 'Teaser') score += 20;
  if (row.iso_639_1 === 'ko') score += 15;
  else if (row.iso_639_1 === 'en') score += 8;
  return score + Number(row.size || 0) / 1000;
}

async function load(id) {
  const hit = cache.get(id);
  if (hit?.expiresAt > Date.now()) return hit.value;
  const [videos, images] = await Promise.all([
    tmdb(`/movie/${id}/videos`, { language: KINOSIS_LOCALE.language }).catch(() => ({ results: [] })),
    tmdb(`/movie/${id}/images`, { include_image_language: 'ko,en,null' }).catch(() => ({ backdrops: [] })),
  ]);
  const trailers = (videos.results || [])
    .filter((row) => row.site === 'YouTube' && row.key && ['Trailer', 'Teaser'].includes(row.type))
    .sort((a, b) => trailerScore(b) - trailerScore(a))
    .slice(0, 4)
    .map((row) => ({ key: row.key, name: row.name || 'Trailer', type: row.type, official: !!row.official }));
  const stills = (images.backdrops || [])
    .filter((row) => row.file_path)
    .sort((a, b) => Number(b.vote_average || 0) - Number(a.vote_average || 0) || Number(b.width || 0) - Number(a.width || 0))
    .slice(0, 12)
    .map((row) => ({ url: imageUrl(row.file_path, 'w780'), originalUrl: imageUrl(row.file_path, 'original'), width: row.width || null, height: row.height || null }));
  const value = { id: String(id), trailers, stills };
  cache.set(id, { value, expiresAt: Date.now() + TTL });
  return value;
}

export default async (request) => {
  if (request.method !== 'GET') return json({ error: 'Method not allowed.' }, 405);
  const url = new URL(request.url);
  const id = (url.searchParams.get('id') || '').trim();
  if (!/^\d+$/.test(id)) return json({ error: 'Invalid movie ID.' }, 400);
  try {
    return json(await load(id), 200, 'public, max-age=3600, stale-while-revalidate=86400', {
      'Netlify-CDN-Cache-Control': 'public, durable, max-age=86400, stale-while-revalidate=604800',
    });
  } catch (error) {
    console.error('movie-media:', error.message);
    return json({ error: error.message || 'Movie media failed.' }, error.status || 500);
  }
};

export const config = { path: '/api/movie-media', method: 'GET', rateLimit: { action: 'rate_limit', aggregateBy: ['ip'], windowSize: 60, windowLimit: 50 } };
