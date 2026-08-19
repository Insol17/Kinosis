import { imageUrl, json, tmdb } from '../lib/tmdb.mjs';

function isoDate(date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}
function movie(m) {
  return {
    id: String(m.id),
    title: m.title || m.original_title || 'Untitled',
    originalTitle: m.original_title || '',
    releaseDate: m.release_date || null,
    year: m.release_date?.slice(0, 4) || null,
    overview: m.overview || '',
    voteAverage: m.vote_average ?? null,
    voteCount: m.vote_count ?? 0,
    popularity: m.popularity ?? 0,
    posterUrl: imageUrl(m.poster_path, 'w500'),
    backdropUrl: imageUrl(m.backdrop_path, 'w1280'),
    source: 'tmdb-live',
  };
}
function norm(value) {
  return String(value || '').normalize('NFKC').toLowerCase().replace(/[^a-z0-9가-힣]+/g, '');
}
function unique(rows) {
  const ids = new Set();
  const identities = new Set();
  const out = [];
  for (const row of rows || []) {
    if (!row?.id) continue;
    const id = String(row.id);
    const identity = `${norm(row.original_title || row.title)}|${String(row.release_date || '').slice(0, 4)}`;
    if (ids.has(id) || (identity !== '|' && identities.has(identity))) continue;
    ids.add(id);
    if (identity !== '|') identities.add(identity);
    out.push(row);
  }
  return out;
}

export default async (request) => {
  if (request.method !== 'GET') return json({ error: 'Method not allowed.' }, 405);
  const today = new Date();
  const end = new Date(today);
  end.setDate(end.getDate() + 120);
  try {
    const pages = await Promise.all([1, 2, 3].map((page) => tmdb('/discover/movie', {
      language: 'ko-KR',
      region: 'KR',
      include_adult: false,
      include_video: false,
      with_release_type: '3|2',
      'release_date.gte': isoDate(today),
      'release_date.lte': isoDate(end),
      sort_by: 'popularity.desc',
      page,
    })));
    const results = unique(pages.flatMap((payload) => payload.results || []))
      .filter((row) => row.poster_path && row.release_date)
      .sort((a, b) => String(a.release_date).localeCompare(String(b.release_date)) || Number(b.popularity || 0) - Number(a.popularity || 0))
      .slice(0, 42)
      .map(movie);
    return json({ region: 'KR', source: 'tmdb-discover-theatrical', results, updatedAt: new Date().toISOString() }, 200, 'public, max-age=0, s-maxage=21600, stale-while-revalidate=86400');
  } catch (error) {
    console.error('upcoming:', error.message);
    return json({ error: error.message || 'Upcoming discovery failed.' }, error.status || 500);
  }
};

export const config = {
  path: '/api/upcoming',
  method: 'GET',
  rateLimit: { action: 'rate_limit', aggregateBy: ['ip'], windowSize: 60, windowLimit: 40 },
};
