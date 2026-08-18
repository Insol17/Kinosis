import { imageUrl, json, tmdb } from '../lib/tmdb.mjs';

const GENRES = new Map([
  ['액션', 28], ['action', 28],
  ['모험', 12], ['adventure', 12],
  ['애니메이션', 16], ['animation', 16],
  ['코미디', 35], ['comedy', 35],
  ['범죄', 80], ['crime', 80],
  ['다큐멘터리', 99], ['다큐', 99], ['documentary', 99],
  ['드라마', 18], ['drama', 18],
  ['가족', 10751], ['family', 10751],
  ['판타지', 14], ['fantasy', 14],
  ['역사', 36], ['history', 36],
  ['공포', 27], ['호러', 27], ['horror', 27],
  ['음악', 10402], ['music', 10402],
  ['미스터리', 9648], ['mystery', 9648],
  ['로맨스', 10749], ['멜로', 10749], ['romance', 10749],
  ['sf', 878], ['sci-fi', 878], ['science fiction', 878], ['과학소설', 878],
  ['스릴러', 53], ['thriller', 53],
  ['전쟁', 10752], ['war', 10752],
  ['서부', 37], ['western', 37],
]);

function normalizeMovie(movie) {
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
  };
}

function normalizePerson(person) {
  return {
    id: String(person.id),
    name: person.name || '',
    knownForDepartment: person.known_for_department || '',
    popularity: person.popularity ?? 0,
    profileUrl: imageUrl(person.profile_path, 'w185'),
    knownFor: (person.known_for || [])
      .filter((item) => item.media_type === 'movie' || item.title || item.original_title)
      .slice(0, 4)
      .map(normalizeMovie),
  };
}

export default async (request) => {
  if (request.method !== 'GET') return json({ error: 'Method not allowed.' }, 405);
  const url = new URL(request.url);
  const query = (url.searchParams.get('q') || '').trim();
  if (query.length < 2) return json({ query, results: [], people: [] });
  if (query.length > 120) return json({ error: 'Search query is too long.' }, 400);

  try {
    const genreId = GENRES.get(query.toLocaleLowerCase('ko-KR')) || GENRES.get(query);
    const tasks = [
      tmdb('/search/movie', {
        query,
        language: 'ko-KR',
        region: 'KR',
        include_adult: false,
        page: 1,
      }),
      tmdb('/search/person', {
        query,
        language: 'ko-KR',
        include_adult: false,
        page: 1,
      }).catch(() => ({ results: [] })),
      genreId ? tmdb('/discover/movie', {
        language: 'ko-KR',
        region: 'KR',
        include_adult: false,
        with_genres: genreId,
        sort_by: 'popularity.desc',
        page: 1,
      }).catch(() => ({ results: [] })) : Promise.resolve({ results: [] }),
    ];

    const [movieData, personData, genreData] = await Promise.all(tasks);
    const map = new Map();
    for (const movie of [...(movieData.results || []), ...(genreData.results || [])]) {
      if (!movie?.id || map.has(String(movie.id))) continue;
      map.set(String(movie.id), normalizeMovie(movie));
    }

    const results = [...map.values()].slice(0, 30);
    const people = (personData.results || []).slice(0, 8).map(normalizePerson);

    return json({
      query,
      page: movieData.page || 1,
      totalResults: movieData.total_results || results.length,
      genreMatched: genreId || null,
      results,
      people,
    }, 200, 'public, max-age=0, s-maxage=300, stale-while-revalidate=1800');
  } catch (error) {
    console.error('movie-search:', error.message);
    return json({ error: error.message || 'Movie search failed.' }, error.status || 500);
  }
};

export const config = {
  path: '/api/movie-search',
  method: 'GET',
};
