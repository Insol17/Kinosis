import { imageUrl, json, tmdb } from '../lib/tmdb.mjs';

function normalizeMovie(movie, score = 0) {
  return {
    id: String(movie.id),
    title: movie.title || movie.original_title || 'Untitled',
    originalTitle: movie.original_title || '',
    releaseDate: movie.release_date || null,
    year: movie.release_date?.slice(0, 4) || null,
    overview: movie.overview || '',
    voteAverage: movie.vote_average ?? null,
    voteCount: movie.vote_count ?? 0,
    popularity: movie.popularity ?? 0,
    genreIds: movie.genre_ids || [],
    posterUrl: imageUrl(movie.poster_path, 'w342'),
    backdropUrl: imageUrl(movie.backdrop_path, 'w780'),
    recommendationScore: score,
  };
}

export default async (request) => {
  if (request.method !== 'GET') return json({ error: 'Method not allowed.' }, 405);
  const url = new URL(request.url);
  const seeds = (url.searchParams.get('seeds') || url.searchParams.get('id') || '')
    .split(',')
    .map((value) => value.trim())
    .filter((value) => /^\d+$/.test(value))
    .slice(0, 3);

  if (!seeds.length) return json({ seeds: [], results: [] });

  try {
    const payloads = await Promise.all(seeds.map(async (id) => {
      const [recommended, similar] = await Promise.all([
        tmdb(`/movie/${id}/recommendations`, { language: 'ko-KR', page: 1 }).catch(() => ({ results: [] })),
        tmdb(`/movie/${id}/similar`, { language: 'ko-KR', page: 1 }).catch(() => ({ results: [] })),
      ]);
      return { id, recommended: recommended.results || [], similar: similar.results || [] };
    }));

    const byId = new Map();
    const seedSet = new Set(seeds);
    for (const payload of payloads) {
      const lists = [
        [payload.recommended, 42],
        [payload.similar, 24],
      ];
      for (const [list, baseScore] of lists) {
        list.slice(0, 20).forEach((movie, index) => {
          const id = String(movie.id);
          if (seedSet.has(id)) return;
          const previous = byId.get(id) || { movie, score: 0, seedHits: new Set() };
          previous.score += Math.max(3, baseScore - index * 1.35);
          previous.score += Math.min(8, Number(movie.vote_average || 0));
          previous.seedHits.add(payload.id);
          previous.movie = movie;
          byId.set(id, previous);
        });
      }
    }

    const results = [...byId.values()]
      .map((entry) => ({
        ...normalizeMovie(entry.movie, entry.score + entry.seedHits.size * 18),
        seedHits: entry.seedHits.size,
      }))
      .sort((a, b) => b.recommendationScore - a.recommendationScore)
      .slice(0, 30);

    return json({ seeds, results }, 200, 'public, max-age=0, s-maxage=1800, stale-while-revalidate=7200');
  } catch (error) {
    console.error('movie-recommendations:', error.message);
    return json({ error: error.message || 'Recommendations failed.' }, error.status || 500);
  }
};

export const config = {
  path: '/api/movie-recommendations',
  method: 'GET',
  rateLimit: { action: 'rate_limit', aggregateBy: ['ip'], windowSize: 60, windowLimit: 30 }
};
