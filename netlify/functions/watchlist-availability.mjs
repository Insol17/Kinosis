import { json, normalizeProviderResults, tmdb } from '../lib/tmdb.mjs';
import { KINOSIS_LOCALE } from '../lib/locale.mjs';
import { applyAvailabilityOverride } from '../../shared/availability-overrides.mjs';
import { collectioAvailability } from '../lib/collectio.mjs';

async function mapLimit(values, limit, worker) {
  const results = new Array(values.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, values.length) }, async () => {
    while (cursor < values.length) {
      const index = cursor++;
      results[index] = await worker(values[index], index);
    }
  });
  await Promise.all(runners);
  return results;
}

export default async (request) => {
  if (request.method !== 'GET') return json({ error: 'Method not allowed.' }, 405);
  const url = new URL(request.url);
  const ids = (url.searchParams.get('ids') || '')
    .split(',')
    .map((value) => value.trim())
    .filter((value) => /^\d+$/.test(value))
    .slice(0, 20);
  const verifyCollectio = url.searchParams.get('verifyCollectio') === '1';

  if (!ids.length) return json({ results: [] });

  try {
    const results = await mapLimit(ids, verifyCollectio ? 4 : 8, async (id) => {
      try {
        const [providerResult, detailResult] = await Promise.allSettled([
          tmdb(`/movie/${id}/watch/providers`),
          verifyCollectio ? tmdb(`/movie/${id}`, { language: KINOSIS_LOCALE.language }) : Promise.resolve(null),
        ]);
        const providerPayload = providerResult.status === 'fulfilled' ? providerResult.value : null;
        const normalized = providerPayload ? normalizeProviderResults(providerPayload, KINOSIS_LOCALE.region) : { providers: [], watchLink: null };
        const providers = [...(normalized.providers || [])];
        let collectio = null;
        const detail = detailResult.status === 'fulfilled' ? detailResult.value : null;
        if (verifyCollectio && detail) {
          collectio = await collectioAvailability({
            title: detail.title,
            originalTitle: detail.original_title,
            year: String(detail.release_date || '').slice(0, 4),
          });
          if (collectio?.provider && !providers.some((provider) => String(provider.name || '').toLowerCase() === 'collectio' && provider.type === collectio.provider.type)) providers.push(collectio.provider);
        }
        return applyAvailabilityOverride(id, KINOSIS_LOCALE.region, {
          id,
          ...(providerPayload || collectio ? { providers, watchLink: normalized.watchLink } : {}),
          availabilitySources: [...new Set([...(providerPayload ? ['tmdb-justwatch'] : []), ...(collectio ? ['collectio-official'] : [])])],
          ...(collectio?.checkedAt ? { availabilityVerifiedAt: collectio.checkedAt } : {}),
          ...(providerResult.status === 'rejected' ? { error: providerResult.reason?.message || 'unavailable' } : {}),
        });
      } catch (error) {
        return applyAvailabilityOverride(id, KINOSIS_LOCALE.region, { id, error: error.message || 'unavailable', availabilitySources: [] });
      }
    });
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
