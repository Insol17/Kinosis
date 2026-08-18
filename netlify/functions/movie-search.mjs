import { imageUrl, json, tmdb } from '../lib/tmdb.mjs';

export default async (request) => {
  if (request.method !== 'GET') return json({ error: 'Method not allowed.' }, 405);
  const url = new URL(request.url);
  const query = (url.searchParams.get('q') || '').trim();
  if (query.length < 2) return json({ query, results: [] });
  if (query.length > 120) return json({ error: 'Search query is too long.' }, 400);

  try {
    const data = await tmdb('/search/movie', {
      query,
      language: 'ko-KR',
      region: 'KR',
      include_adult: false,
      page: 1,
    });

    const results = (data.results || []).slice(0, 20).map((movie) => ({
      id: String(movie.id),
      title: movie.title || movie.original_title || 'Untitled',
      originalTitle: movie.original_title || '',
      releaseDate: movie.release_date || null,
      year: movie.release_date?.slice(0, 4) || null,
      overview: movie.overview || '',
      voteAverage: movie.vote_average ?? null,
      voteCount: movie.vote_count ?? 0,
      posterUrl: imageUrl(movie.poster_path, 'w342'),
      backdropUrl: imageUrl(movie.backdrop_path, 'w780'),
    }));

    return json({ query, page: data.page || 1, totalResults: data.total_results || results.length, results }, 200, 'public, max-age=0, s-maxage=300, stale-while-revalidate=1800');
  } catch (error) {
    console.error('movie-search:', error.message);
    return json({ error: error.message || 'Movie search failed.' }, error.status || 500);
  }
};

export const config = {
  path: '/api/movie-search',
  method: 'GET',
};
