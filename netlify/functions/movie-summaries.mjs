import { imageUrl, json, tmdb } from '../lib/tmdb.mjs';
import { KINOSIS_LOCALE } from '../lib/locale.mjs';

function normalize(movie) {
  return {
    id: String(movie.id),
    title: movie.title || movie.original_title || 'Untitled',
    originalTitle: movie.original_title || '',
    releaseDate: movie.release_date || null,
    year: movie.release_date?.slice(0, 4) || null,
    runtime: movie.runtime || null,
    overview: movie.overview || '',
    voteAverage: movie.vote_average ?? null,
    voteCount: movie.vote_count ?? 0,
    genres: (movie.genres || []).map((genre) => ({ id: genre.id, name: genre.name })),
    productionCountries: (movie.production_countries || []).map((country) => country.name).filter(Boolean),
    originalLanguage: movie.original_language || null,
    posterUrl: imageUrl(movie.poster_path, 'w342'),
    backdropUrl: imageUrl(movie.backdrop_path, 'w780'),
  };
}

export default async (request) => {
  if (request.method !== 'GET') return json({ error: 'Method not allowed.' }, 405);
  const url = new URL(request.url);
  const ids = [...new Set((url.searchParams.get('ids') || '')
    .split(',')
    .map((value) => value.trim())
    .filter((value) => /^\d+$/.test(value)))]
    .slice(0, 20);

  if (!ids.length) return json({ results: [] });

  const results = [];
  const errors = [];
  let cursor = 0;
  const workers = Array.from({ length: Math.min(5, ids.length) }, async () => {
    while (cursor < ids.length) {
      const id = ids[cursor++];
      try {
        const movie = await tmdb(`/movie/${id}`, { language: KINOSIS_LOCALE.language });
        results.push(normalize(movie));
      } catch (error) {
        errors.push({ id, error: error.message || 'unavailable' });
      }
    }
  });
  await Promise.all(workers);
  const order = new Map(ids.map((id, index) => [id, index]));
  results.sort((a, b) => (order.get(String(a.id)) ?? 999) - (order.get(String(b.id)) ?? 999));
  errors.sort((a, b) => (order.get(String(a.id)) ?? 999) - (order.get(String(b.id)) ?? 999));

  return json({ results, errors }, 200, 'public, max-age=0, s-maxage=21600, stale-while-revalidate=86400');
};

export const config = {
  path: '/api/movie-summaries',
  method: 'GET',
  rateLimit: { action: 'rate_limit', aggregateBy: ['ip'], windowSize: 60, windowLimit: 30 },
};
