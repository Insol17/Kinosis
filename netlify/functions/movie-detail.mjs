import { imageUrl, json, tmdb } from '../lib/tmdb.mjs';
import { KINOSIS_LOCALE } from '../lib/locale.mjs';

const STATIC_TTL = 24 * 60 * 60 * 1000;
const staticCache = new Map();

async function loadStatic(id) {
  const hit = staticCache.get(id);
  if (hit?.expiresAt > Date.now()) return hit.value;

  // Static film metadata is intentionally isolated from volatile availability.
  // TMDB supports append_to_response, so the critical path is one upstream round trip
  // instead of waiting for separate detail + credits requests.
  const detail = await tmdb(`/movie/${id}`, {
    language: KINOSIS_LOCALE.language,
    append_to_response: 'credits',
  });
  const credits = detail.credits || { crew: [], cast: [] };
  const value = { detail, credits };
  staticCache.set(id, { value, expiresAt: Date.now() + STATIC_TTL });
  return value;
}

export default async (request) => {
  if (request.method !== 'GET') return json({ error: 'Method not allowed.' }, 405);
  const url = new URL(request.url);
  const id = (url.searchParams.get('id') || '').trim();
  if (!/^\d+$/.test(id)) return json({ error: 'Invalid movie ID.' }, 400);

  try {
    const { detail, credits } = await loadStatic(id);
    const directorCredit = (credits.crew || []).find((person) => person.job === 'Director') || null;
    const writers = [...new Map((credits.crew || []).filter((person) => ['Writer', 'Screenplay', 'Story'].includes(person.job)).map((person) => [person.id || person.name, { id: person.id || null, name: person.name, job: person.job }])).values()].slice(0, 5);
    const cinematographers = [...new Map((credits.crew || []).filter((person) => person.job === 'Director of Photography').map((person) => [person.id || person.name, { id: person.id || null, name: person.name }])).values()].slice(0, 3);

    return json({
      id: String(detail.id),
      title: detail.title || detail.original_title || 'Untitled',
      originalTitle: detail.original_title || '',
      releaseDate: detail.release_date || null,
      year: detail.release_date?.slice(0, 4) || null,
      runtime: detail.runtime || null,
      overview: detail.overview || '',
      tagline: detail.tagline || '',
      voteAverage: detail.vote_average ?? null,
      voteCount: detail.vote_count ?? 0,
      director: directorCredit?.name || null,
      directorId: directorCredit?.id || null,
      cast: (credits.cast || []).slice(0, 12).map((person) => ({ id: person.id, name: person.name, character: person.character || '', profileUrl: imageUrl(person.profile_path, 'w185') })),
      writers,
      cinematographers,
      genres: (detail.genres || []).map((genre) => ({ id: genre.id, name: genre.name })),
      productionCountries: (detail.production_countries || []).map((country) => country.name).filter(Boolean),
      originalLanguage: detail.original_language || null,
      productionCompanies: (detail.production_companies || []).map((company) => company.name).filter(Boolean),
      posterUrl: imageUrl(detail.poster_path, 'w500'),
      backdropUrl: imageUrl(detail.backdrop_path, 'w1280'),
      heroBackdropUrl: imageUrl(detail.backdrop_path, 'w1280'),
    }, 200, 'public, max-age=0, s-maxage=86400, stale-while-revalidate=604800');
  } catch (error) {
    console.error('movie-detail:', error.message);
    return json({ error: error.message || 'Movie detail failed.' }, error.status || 500);
  }
};

export const config = {
  path: '/api/movie-detail',
  method: 'GET',
  rateLimit: { action: 'rate_limit', aggregateBy: ['ip'], windowSize: 60, windowLimit: 50 },
};
