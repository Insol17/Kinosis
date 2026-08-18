import { imageUrl, json, tmdb } from '../lib/tmdb.mjs';

function normalizeMovie(movie, role = '') {
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
    posterUrl: imageUrl(movie.poster_path, 'w342'),
    backdropUrl: imageUrl(movie.backdrop_path, 'w780'),
    personRole: role,
  };
}

export default async (request) => {
  if (request.method !== 'GET') return json({ error: 'Method not allowed.' }, 405);
  const url = new URL(request.url);
  const id = (url.searchParams.get('id') || '').trim();
  if (!/^\d+$/.test(id)) return json({ error: 'Invalid person ID.' }, 400);

  try {
    const [person, credits] = await Promise.all([
      tmdb(`/person/${id}`, { language: 'ko-KR' }),
      tmdb(`/person/${id}/movie_credits`, { language: 'ko-KR' }),
    ]);

    const rows = [];
    for (const movie of credits.cast || []) rows.push({ movie, role: movie.character || 'Cast', priority: 2 });
    for (const movie of credits.crew || []) {
      const job = movie.job || movie.department || 'Crew';
      const priority = job === 'Director' ? 7 : job === 'Writer' || job === 'Screenplay' ? 4 : 1;
      rows.push({ movie, role: job, priority });
    }

    const byId = new Map();
    for (const row of rows) {
      if (!row.movie?.id || !row.movie?.release_date) continue;
      const key = String(row.movie.id);
      const current = byId.get(key);
      const score = row.priority * 100 + Number(row.movie.popularity || 0) + Number(row.movie.vote_count || 0) / 500;
      if (!current || score > current.score) byId.set(key, { ...row, score });
    }

    const results = [...byId.values()]
      .sort((a, b) => b.score - a.score)
      .slice(0, 40)
      .map((row) => normalizeMovie(row.movie, row.role));

    return json({
      person: {
        id: String(person.id),
        name: person.name,
        knownForDepartment: person.known_for_department || '',
        biography: person.biography || '',
        profileUrl: imageUrl(person.profile_path, 'w185'),
      },
      results,
    }, 200, 'public, max-age=0, s-maxage=21600, stale-while-revalidate=86400');
  } catch (error) {
    console.error('person-films:', error.message);
    return json({ error: error.message || 'Person filmography failed.' }, error.status || 500);
  }
};

export const config = {
  path: '/api/person-films',
  method: 'GET',
};
