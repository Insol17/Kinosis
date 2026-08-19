import { imageUrl, json, normalizeProviderResults, tmdb } from '../lib/tmdb.mjs';
import { KINOSIS_LOCALE } from '../lib/locale.mjs';

const DAY = 86400000;
const STATIC_TTL = 24 * 60 * 60 * 1000;
const AVAILABILITY_TTL = 4 * 60 * 60 * 1000;
const NOW_PLAYING_TTL = 30 * 60 * 1000;
const staticCache = new Map();
const availabilityCache = new Map();
let nowPlayingCache = { expiresAt: 0, ids: new Set() };

async function cached(map, key, ttl, loader) {
  const hit = map.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value;
  const value = await loader();
  map.set(key, { value, expiresAt: Date.now() + ttl });
  return value;
}

async function loadStatic(id) {
  return cached(staticCache, id, STATIC_TTL, async () => {
    const [detail, credits, externalIds, keywordsPayload, releasePayload] = await Promise.all([
      tmdb(`/movie/${id}`, { language: KINOSIS_LOCALE.language }),
      tmdb(`/movie/${id}/credits`, { language: KINOSIS_LOCALE.language }).catch(() => ({ crew: [], cast: [] })),
      tmdb(`/movie/${id}/external_ids`).catch(() => ({})),
      tmdb(`/movie/${id}/keywords`).catch(() => ({ keywords: [] })),
      tmdb(`/movie/${id}/release_dates`).catch(() => ({ results: [] })),
    ]);
    return { detail, credits, externalIds, keywordsPayload, releasePayload };
  });
}

async function loadAvailability(id) {
  return cached(availabilityCache, id, AVAILABILITY_TTL, async () => {
    const payload = await tmdb(`/movie/${id}/watch/providers`).catch(() => ({ results: {} }));
    return { ...normalizeProviderResults(payload, KINOSIS_LOCALE.region), availabilityUpdatedAt: new Date().toISOString() };
  });
}

async function currentTheatricalIds() {
  if (nowPlayingCache.expiresAt > Date.now()) return nowPlayingCache.ids;
  const pages = await Promise.all([1, 2, 3].map((page) => tmdb('/movie/now_playing', { language: KINOSIS_LOCALE.language, region: KINOSIS_LOCALE.region, page }).catch(() => ({ results: [] }))));
  const ids = new Set(pages.flatMap((payload) => payload.results || []).map((row) => String(row.id)));
  nowPlayingCache = { ids, expiresAt: Date.now() + NOW_PLAYING_TTL };
  return ids;
}

export default async (request) => {
  if (request.method !== 'GET') return json({ error: 'Method not allowed.' }, 405);
  const url = new URL(request.url);
  const id = (url.searchParams.get('id') || '').trim();
  if (!/^\d+$/.test(id)) return json({ error: 'Invalid movie ID.' }, 400);

  try {
    const [{ detail, credits, externalIds, keywordsPayload, releasePayload }, availability] = await Promise.all([loadStatic(id), loadAvailability(id)]);
    const directorCredit = (credits.crew || []).find((person) => person.job === 'Director') || null;
    const krReleaseDates = (releasePayload.results || []).find((row) => row.iso_3166_1 === KINOSIS_LOCALE.region)?.release_dates || [];
    const theatricalDates = krReleaseDates.filter((row) => row.type === 2 || row.type === 3).map((row) => row.release_date).filter(Boolean).sort();
    const theatricalReleaseDate = theatricalDates[0] || null;
    const releaseTime = theatricalReleaseDate ? Date.parse(theatricalReleaseDate) : 0;
    const now = Date.now();
    let theatricalStatus = releaseTime ? (releaseTime > now + DAY ? 'upcoming' : releaseTime >= now - 120 * DAY ? 'recent' : 'past') : null;
    let theatricalEvidence = theatricalStatus === 'upcoming' ? 'kr-release-date' : theatricalStatus === 'recent' ? 'kr-recent-release' : null;

    // Expensive now-playing verification is only meaningful close to a KR theatrical opening.
    if (theatricalStatus === 'recent' && releaseTime >= now - 45 * DAY) {
      try {
        if ((await currentTheatricalIds()).has(String(detail.id))) {
          theatricalStatus = 'now';
          theatricalEvidence = 'tmdb-kr-now-playing';
        }
      } catch (error) {
        console.warn('movie-detail now-playing check:', error.message);
      }
    }

    const writers = [...new Map((credits.crew || []).filter((person) => ['Writer','Screenplay','Story'].includes(person.job)).map((person) => [person.id || person.name, { id: person.id || null, name: person.name, job: person.job }])).values()].slice(0, 5);
    const cinematographers = [...new Map((credits.crew || []).filter((person) => person.job === 'Director of Photography').map((person) => [person.id || person.name, { id: person.id || null, name: person.name }])).values()].slice(0, 3);

    return json({
      id: String(detail.id), title: detail.title || detail.original_title || 'Untitled', originalTitle: detail.original_title || '',
      releaseDate: theatricalReleaseDate || detail.release_date || null, year: (theatricalReleaseDate || detail.release_date || '').slice(0, 4) || null,
      runtime: detail.runtime || null, overview: detail.overview || '', tagline: detail.tagline || '', voteAverage: detail.vote_average ?? null, voteCount: detail.vote_count ?? 0,
      director: directorCredit?.name || null, directorId: directorCredit?.id || null,
      cast: (credits.cast || []).slice(0, 12).map((person) => ({ id: person.id, name: person.name, character: person.character || '', profileUrl: imageUrl(person.profile_path, 'w185') })),
      writers, cinematographers, genres: (detail.genres || []).map((genre) => ({ id: genre.id, name: genre.name })),
      productionCountries: (detail.production_countries || []).map((country) => country.name).filter(Boolean), originalLanguage: detail.original_language || null,
      theatricalStatus, theatricalEvidence, theatricalReleaseDate,
      keywords: (keywordsPayload.keywords || keywordsPayload.results || []).map((keyword) => keyword.name).filter(Boolean),
      productionCompanies: (detail.production_companies || []).map((company) => company.name).filter(Boolean),
      posterUrl: imageUrl(detail.poster_path, 'w500'), backdropUrl: imageUrl(detail.backdrop_path, 'w1280'), heroBackdropUrl: imageUrl(detail.backdrop_path, 'w1280'),
      imdbId: externalIds.imdb_id || null, providers: availability.providers, watchLink: availability.watchLink, availabilityUpdatedAt: availability.availabilityUpdatedAt,
    }, 200, 'public, max-age=0, s-maxage=14400, stale-while-revalidate=86400');
  } catch (error) {
    console.error('movie-detail:', error.message);
    return json({ error: error.message || 'Movie detail failed.' }, error.status || 500);
  }
};

export const config = { path: '/api/movie-detail', method: 'GET', rateLimit: { action: 'rate_limit', aggregateBy: ['ip'], windowSize: 60, windowLimit: 50 } };
