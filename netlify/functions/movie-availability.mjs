import { json, normalizeProviderResults, tmdb } from '../lib/tmdb.mjs';
import { KINOSIS_LOCALE } from '../lib/locale.mjs';
import theatricalSnapshot from '../../data/theatrical-kr.mjs';
import { applyAvailabilityOverride } from '../../shared/availability-overrides.mjs';
import { collectioAvailability } from '../lib/collectio.mjs';

const DAY = 86400000;
const AVAILABILITY_TTL = 4 * 60 * 60 * 1000;
const NOW_PLAYING_TTL = 30 * 60 * 1000;
const cache = new Map();
let nowPlayingCache = { expiresAt: 0, ids: new Set() };

const KOBIS_CURRENT_IDS = new Set(
  theatricalSnapshot?.mode === 'kobis-snapshot'
    ? (theatricalSnapshot.boxOffice || []).map((row) => String(row.tmdbId || row.id || '')).filter((id) => /^\d+$/.test(id))
    : [],
);

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
  if (hit?.expiresAt > Date.now()) return json(hit.value, 200, 'public, max-age=900, stale-while-revalidate=3600', { 'Netlify-CDN-Cache-Control': 'public, durable, max-age=14400, stale-while-revalidate=86400', 'Server-Timing': 'cache;desc="MEMORY_HIT", tmdb;dur=0' });

  try {
    const tmdbStartedAt = Date.now();
    const suppliedTitle = String(url.searchParams.get('title') || '').trim();
    const suppliedOriginalTitle = String(url.searchParams.get('originalTitle') || '').trim();
    const suppliedYear = String(url.searchParams.get('year') || '').trim().slice(0, 4);
    const needsDetailForCollectio = !suppliedTitle;
    const [providerResult, releaseResult, detailResult] = await Promise.allSettled([
      tmdb(`/movie/${id}/watch/providers`),
      tmdb(`/movie/${id}/release_dates`),
      needsDetailForCollectio ? tmdb(`/movie/${id}`, { language: KINOSIS_LOCALE.language }) : Promise.resolve(null),
    ]);
    const providerPayload = providerResult.status === 'fulfilled' ? providerResult.value : null;
    const releasePayload = releaseResult.status === 'fulfilled' ? releaseResult.value : { results: [] };
    const availability = providerPayload ? normalizeProviderResults(providerPayload, KINOSIS_LOCALE.region) : { providers: undefined, watchLink: undefined };
    const detail = detailResult.status === 'fulfilled' ? detailResult.value : null;
    const collectioTitle = suppliedTitle || detail?.title || '';
    const collectioOriginalTitle = suppliedOriginalTitle || detail?.original_title || '';
    const collectioYear = suppliedYear || String(detail?.release_date || '').slice(0, 4);
    const collectio = collectioTitle ? await collectioAvailability({
      title: collectioTitle,
      originalTitle: collectioOriginalTitle,
      year: collectioYear,
    }) : null;
    const providers = Array.isArray(availability.providers) ? [...availability.providers] : [];
    if (collectio?.provider && !providers.some((provider) => String(provider.name || '').toLowerCase() === 'collectio' && provider.type === collectio.provider.type)) {
      providers.push(collectio.provider);
    }
    const krReleaseDates = (releasePayload.results || []).find((row) => row.iso_3166_1 === KINOSIS_LOCALE.region)?.release_dates || [];
    const theatricalDates = krReleaseDates.filter((row) => row.type === 2 || row.type === 3).map((row) => row.release_date).filter(Boolean).sort();
    const theatricalReleaseDate = theatricalDates[0] || null;
    const releaseTime = theatricalReleaseDate ? Date.parse(theatricalReleaseDate) : 0;
    const now = Date.now();
    let theatricalStatus = releaseTime ? (releaseTime > now + DAY ? 'upcoming' : 'past') : null;
    let theatricalEvidence = theatricalStatus === 'upcoming' ? 'kr-release-date' : null;

    // A release date is historical metadata, not evidence that a film is still
    // playing. Only current KOBIS/TMDB evidence can promote a film to `now`.
    if (KOBIS_CURRENT_IDS.has(id)) {
      theatricalStatus = 'now';
      theatricalEvidence = 'kobis-current-box-office';
    } else if (releaseTime && releaseTime >= now - 45 * DAY && (await currentTheatricalIds()).has(id)) {
      theatricalStatus = 'now';
      theatricalEvidence = 'tmdb-kr-now-playing';
    }

    let value = {
      id,
      ...((providerPayload || collectio) ? { providers, watchLink: availability.watchLink } : {}),
      availabilityUpdatedAt: new Date().toISOString(),
      availabilitySources: [...new Set([...(providerPayload ? ['tmdb-justwatch'] : []), ...(collectio ? ['collectio-official'] : [])])],
      ...(collectio?.checkedAt ? { availabilityVerifiedAt: collectio.checkedAt } : {}),
      providerError: providerResult.status === 'rejected' ? (providerResult.reason?.message || 'provider lookup failed') : null,
      theatricalStatus,
      theatricalEvidence,
      theatricalReleaseDate,
    };
    value = applyAvailabilityOverride(id, KINOSIS_LOCALE.region, value);
    cache.set(id, { value, expiresAt: Date.now() + AVAILABILITY_TTL });
    return json(value, 200, 'public, max-age=900, stale-while-revalidate=3600', { 'Netlify-CDN-Cache-Control': 'public, durable, max-age=14400, stale-while-revalidate=86400', 'Server-Timing': `cache;desc="MISS", tmdb;dur=${Date.now() - tmdbStartedAt}` });
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
