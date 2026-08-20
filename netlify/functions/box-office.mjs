import theatrical from '../../data/theatrical-kr.mjs';
import { json } from '../lib/tmdb.mjs';

/**
 * Public KOBIS data is served from the repository/build snapshot.
 * Browser traffic therefore never consumes the KOBIS daily quota. The
 * scheduled ingest job is the only normal KOBIS caller.
 */
export default async (request) => {
  if (request.method !== 'GET') return json({ error: 'Method not allowed.' }, 405);
  const results = Array.isArray(theatrical?.boxOffice) ? theatrical.boxOffice : [];
  if (!results.length) return json({ error: 'KOBIS snapshot is not ready.' }, 503, 'public, max-age=300, s-maxage=300');
  return json({ mode: theatrical.mode || 'snapshot', targetDt: theatrical.targetDt || null, updatedAt: theatrical.updatedAt || null, results }, 200,
    'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800');
};

export const config = {
  path: '/api/box-office', method: 'GET',
  rateLimit: { action: 'rate_limit', aggregateBy: ['ip'], windowSize: 60, windowLimit: 120 },
};
