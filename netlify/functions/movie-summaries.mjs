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
  // Summary recovery is an exception path. Keep batches deliberately small so a
  // single slow TMDB item cannot turn Library hydration into a 20–30 second call.
  const ids = [...new Set((url.searchParams.get('ids') || '')
    .split(',')
    .map((value) => value.trim())
    .filter((value) => /^\d+$/.test(value)))]
    .slice(0, 6);

  if (!ids.length) return json({ results: [] });

  const settled = await Promise.all(ids.map(async (id) => {
    try {
      const movie = await tmdb(`/movie/${id}`, { language: KINOSIS_LOCALE.language });
      return { ok: true, id, movie: normalize(movie) };
    } catch (error) {
      return { ok: false, id, error: error.message || 'unavailable' };
    }
  }));
  const results = settled.filter((row) => row.ok).map((row) => row.movie);
  const errors = settled.filter((row) => !row.ok).map(({ id, error }) => ({ id, error }));

  return json({ results, errors }, 200, 'public, max-age=3600, stale-while-revalidate=21600', { 'Netlify-CDN-Cache-Control': 'public, durable, max-age=21600, stale-while-revalidate=86400' });
};

export const config = {
  path: '/api/movie-summaries',
  method: 'GET',
  rateLimit: { action: 'rate_limit', aggregateBy: ['ip'], windowSize: 60, windowLimit: 40 },
};
