import { json, normalizeProviderResults, tmdb } from '../lib/tmdb.mjs';
import { KINOSIS_LOCALE } from '../lib/locale.mjs';
import { applyAvailabilityOverride } from '../../shared/availability-overrides.mjs';

export default async (request) => {
  if (request.method !== 'GET') return json({ error: 'Method not allowed.' }, 405);
  const url = new URL(request.url);
  const ids = (url.searchParams.get('ids') || '')
    .split(',')
    .map((value) => value.trim())
    .filter((value) => /^\d+$/.test(value))
    .slice(0, 20);

  if (!ids.length) return json({ results: [] });

  try {
    const results = await Promise.all(ids.map(async (id) => {
      try {
        const payload = await tmdb(`/movie/${id}/watch/providers`);
        const { providers, watchLink } = normalizeProviderResults(payload, KINOSIS_LOCALE.region);
        return applyAvailabilityOverride(id, KINOSIS_LOCALE.region, { id, providers, watchLink, availabilitySources: ['tmdb-justwatch'] });
      } catch (error) {
        return applyAvailabilityOverride(id, KINOSIS_LOCALE.region, { id, error: error.message || 'unavailable', availabilitySources: [] });
      }
    }));
    return json({ results }, 200, 'public, max-age=0, s-maxage=1800, stale-while-revalidate=7200');
  } catch (error) {
    console.error('watchlist-availability:', error.message);
    return json({ error: error.message || 'Availability check failed.' }, error.status || 500);
  }
};

export const config = {
  path: '/api/watchlist-availability',
  method: 'GET',
  rateLimit: { action: 'rate_limit', aggregateBy: ['ip'], windowSize: 60, windowLimit: 25 }
};
