import { json, normalizeProviderResults, tmdb } from '../lib/tmdb.mjs';
import { KINOSIS_LOCALE } from '../lib/locale.mjs';

const DAY = 86400000;
const AVAILABILITY_TTL = 4 * 60 * 60 * 1000;
const NOW_PLAYING_TTL = 30 * 60 * 1000;
const cache = new Map();
let nowPlayingCache = { expiresAt: 0, ids: new Set() };

async function currentTheatricalIds() {
  if (nowPlayingCache.expiresAt > Date.now()) return nowPlayingCache.ids;
  // This is deliberately a single KR page. It is supplementary evidence only and,
  // unlike 0.4.4.5, never blocks static film metadata rendering.
  const payload = await tmdb('/movie/now_playing', {
    language: KINOSIS_LOCALE.language,
    region: KINOSIS_LOCALE.region,
    page: 1,
  }).catch(() => ({ results: [] }));
  const ids = new Set((payload.results || []).map((row) => String(row.id)));
  nowPlayingCache = { ids, expiresAt: Date.now() + NOW_PLAYING_TTL };
  return ids;
}

export default async (request) => {
  if (request.method !== 'GET') return json({ error: 'Method not allowed.' }, 405);
  const url = new URL(request.url);
  const id = (url.searchParams.get('id') || '').trim();
  if (!/^\d+$/.test(id)) return json({ error: 'Invalid movie ID.' }, 400);

  const hit = cache.get(id);
  if (hit?.expiresAt > Date.now()) return json(hit.value, 200, 'public, max-age=0, s-maxage=14400, stale-while-revalidate=86400');

  try {
    const [providerPayload, releasePayload] = await Promise.all([
      tmdb(`/movie/${id}/watch/providers`).catch(() => ({ results: {} })),
      tmdb(`/movie/${id}/release_dates`).catch(() => ({ results: [] })),
    ]);
    const availability = normalizeProviderResults(providerPayload, KINOSIS_LOCALE.region);
    const krReleaseDates = (releasePayload.results || []).find((row) => row.iso_3166_1 === KINOSIS_LOCALE.region)?.release_dates || [];
    const theatricalDates = krReleaseDates.filter((row) => row.type === 2 || row.type === 3).map((row) => row.release_date).filter(Boolean).sort();
    const theatricalReleaseDate = theatricalDates[0] || null;
    const releaseTime = theatricalReleaseDate ? Date.parse(theatricalReleaseDate) : 0;
    const now = Date.now();
    let theatricalStatus = releaseTime ? (releaseTime > now + DAY ? 'upcoming' : releaseTime >= now - 120 * DAY ? 'recent' : 'past') : null;
    let theatricalEvidence = theatricalStatus === 'upcoming' ? 'kr-release-date' : theatricalStatus === 'recent' ? 'kr-recent-release' : null;

    if (theatricalStatus === 'recent' && releaseTime >= now - 45 * DAY) {
      if ((await currentTheatricalIds()).has(id)) {
        theatricalStatus = 'now';
        theatricalEvidence = 'tmdb-kr-now-playing';
      }
    }

    const value = {
      id,
      providers: availability.providers,
      watchLink: availability.watchLink,
      availabilityUpdatedAt: new Date().toISOString(),
      theatricalStatus,
      theatricalEvidence,
      theatricalReleaseDate,
    };
    cache.set(id, { value, expiresAt: Date.now() + AVAILABILITY_TTL });
    return json(value, 200, 'public, max-age=0, s-maxage=14400, stale-while-revalidate=86400');
  } catch (error) {
    console.error('movie-availability:', error.message);
    return json({ error: error.message || 'Movie availability failed.' }, error.status || 500);
  }
};

export const config = {
  path: '/api/movie-availability',
  method: 'GET',
  rateLimit: { action: 'rate_limit', aggregateBy: ['ip'], windowSize: 60, windowLimit: 50 },
};
