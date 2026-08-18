import { imageUrl, json, tmdb } from '../lib/tmdb.mjs';

function kstDateOffset(days) {
  const now = new Date(Date.now() + days * 86400000);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const get = (type) => parts.find((part) => part.type === type)?.value || '';
  return `${get('year')}${get('month')}${get('day')}`;
}

async function kobisDaily(key, targetDt) {
  const url = new URL('https://www.kobis.or.kr/kobisopenapi/webservice/rest/boxoffice/searchDailyBoxOfficeList.json');
  url.searchParams.set('key', key);
  url.searchParams.set('targetDt', targetDt);
  const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error(`KOBIS request failed (${response.status})`);
  const body = await response.json();
  return body?.boxOfficeResult?.dailyBoxOfficeList || [];
}

function movieRecord(movie, row) {
  const open = String(row.openDt || '');
  const krOpenDate = /^\d{8}$/.test(open) ? `${open.slice(0,4)}-${open.slice(4,6)}-${open.slice(6,8)}` : null;
  return {
    id: String(movie.id),
    title: movie.title || movie.original_title || row.movieNm,
    originalTitle: movie.original_title || '',
    year: krOpenDate?.slice(0, 4) || movie.release_date?.slice(0, 4) || null,
    releaseDate: krOpenDate || movie.release_date || null,
    theatricalReleaseDate: krOpenDate,
    overview: movie.overview || '',
    voteAverage: movie.vote_average ?? null,
    voteCount: movie.vote_count ?? 0,
    popularity: movie.popularity ?? 0,
    posterUrl: imageUrl(movie.poster_path, 'w500'),
    backdropUrl: imageUrl(movie.backdrop_path, 'w1280'),
    boxOfficeRank: Number(row.rank) || null,
    boxOfficeAudience: Number(row.audiAcc) || null,
    source: 'kobis-live',
    theatricalStatus: 'now',
  };
}

export default async (request) => {
  if (request.method !== 'GET') return json({ error: 'Method not allowed.' }, 405);
  const key = process.env.KOBIS_API_KEY?.trim();
  if (!key) return json({ error: 'KOBIS_API_KEY is not configured.' }, 503, 'no-store');

  try {
    const targetDt = kstDateOffset(-1);
    const rows = (await kobisDaily(key, targetDt)).slice(0, 10);
    const results = [];
    for (const row of rows) {
      try {
        const search = await tmdb('/search/movie', {
          query: row.movieNm,
          language: 'ko-KR',
          region: 'KR',
          include_adult: false,
          page: 1,
        });
        const year = String(row.openDt || '').slice(0, 4);
        const movie = (search.results || []).find((item) => String(item.release_date || '').slice(0, 4) === year)
          || search.results?.[0];
        if (movie) results.push(movieRecord(movie, row));
      } catch (error) {
        console.warn('box-office TMDB match:', row.movieNm, error.message);
      }
    }
    results.sort((a, b) => Number(a.boxOfficeRank || 99) - Number(b.boxOfficeRank || 99));
    if (results.length < 5) throw new Error(`Only ${results.length} KOBIS titles could be matched to TMDB.`);
    return json({ mode: 'kobis', targetDt, results }, 200, 'public, max-age=0, s-maxage=1800, stale-while-revalidate=7200');
  } catch (error) {
    console.error('box-office:', error.message);
    return json({ error: error.message || 'Box office lookup failed.' }, 502);
  }
};

export const config = { path: '/api/box-office', method: 'GET',
  rateLimit: { action: 'rate_limit', aggregateBy: ['ip'], windowSize: 60, windowLimit: 40 }
};
