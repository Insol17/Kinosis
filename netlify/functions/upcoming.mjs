import theatrical from '../../data/theatrical-kr.mjs';
import { json } from '../lib/tmdb.mjs';

/** Korean theatrical opening snapshot. KOBIS is ingested out of band. */
export default async (request) => {
  if (request.method !== 'GET') return json({ error: 'Method not allowed.' }, 405);
  const results = Array.isArray(theatrical?.upcoming) ? theatrical.upcoming : [];
  if (!results.length) return json({ error: 'KOBIS upcoming snapshot is not ready.' }, 503, 'public, max-age=300, s-maxage=300');
  return json({ region: 'KR', source: theatrical.sources?.upcoming || 'KOBIS snapshot', updatedAt: theatrical.updatedAt || null, results }, 200,
    'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800');
};

export const config = {
  path: '/api/upcoming', method: 'GET',
  rateLimit: { action: 'rate_limit', aggregateBy: ['ip'], windowSize: 60, windowLimit: 120 },
};
