import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const TOKEN = process.env.TMDB_READ_ACCESS_TOKEN?.trim();
const KOBIS_KEY = process.env.KOBIS_API_KEY?.trim();
const REGION = 'KR';
const LANGUAGE = 'ko-KR';
const API = 'https://api.themoviedb.org/3';
const OUT_JSON = path.join(ROOT, 'data/theatrical-kr.json');
const OUT_JS = path.join(ROOT, 'data/theatrical-kr.js');
const OUT_MJS = path.join(ROOT, 'data/theatrical-kr.mjs');
const MAP_FILE = path.join(ROOT, 'data/kobis-tmdb-map.json');
const CATALOG_FILE = path.join(ROOT, 'data/catalog.json');

const OPTIONAL_KEYS = process.argv.includes('--if-keys');
if (!TOKEN || !KOBIS_KEY) {
  if (OPTIONAL_KEYS) {
    console.log('theatrical: KOBIS/TMDB build keys absent; keeping committed snapshot.');
    process.exit(0);
  }
  if (!TOKEN) throw new Error('TMDB_READ_ACCESS_TOKEN is required for theatrical enrichment.');
  throw new Error('KOBIS_API_KEY is required. Store it as a server/build secret, never in frontend code.');
}

const tmdbHeaders = { Authorization: `Bearer ${TOKEN}`, accept: 'application/json' };
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function kstParts(offsetDays = 0) {
  const date = new Date(Date.now() + offsetDays * 86400000);
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value || '';
  return { compact: `${get('year')}${get('month')}${get('day')}`, iso: `${get('year')}-${get('month')}-${get('day')}` };
}
function addDaysCompact(days) { return kstParts(days).compact; }
function isoFromCompact(value) {
  const raw = String(value || '');
  return /^\d{8}$/.test(raw) ? `${raw.slice(0,4)}-${raw.slice(4,6)}-${raw.slice(6,8)}` : null;
}
function normalizeTitle(value) { return String(value || '').normalize('NFKC').toLowerCase().replace(/[^a-z0-9가-힣]+/g, ''); }

async function tmdb(endpoint, params = {}, attempt = 0) {
  const url = new URL(API + endpoint);
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  const response = await fetch(url, { headers: tmdbHeaders, signal: AbortSignal.timeout(8000) });
  if (response.ok) return response.json();
  if ((response.status === 429 || response.status >= 500) && attempt < 3) {
    await sleep(500 * 2 ** attempt);
    return tmdb(endpoint, params, attempt + 1);
  }
  throw new Error(`TMDB ${response.status}: ${url.pathname}`);
}

async function kobis(endpoint, params = {}) {
  const url = new URL(`https://www.kobis.or.kr/kobisopenapi/webservice/rest/${endpoint}`);
  url.searchParams.set('key', KOBIS_KEY);
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error(`KOBIS ${response.status}: ${endpoint}`);
  return response.json();
}

async function readJson(file, fallback) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch { return fallback; }
}

async function pool(items, size, mapper) {
  const out = new Array(items.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      try { out[index] = await mapper(items[index], index); }
      catch (error) { console.warn(`theatrical row skipped: ${items[index]?.movieNm || items[index]?.movieCd || index}: ${error.message}`); out[index] = null; }
    }
  }));
  return out.filter(Boolean);
}

function kobisDirector(row) {
  const rows = Array.isArray(row?.directors) ? row.directors : [];
  return rows.map((item) => item?.peopleNm).filter(Boolean).join(', ');
}

function scoreCandidate(candidate, row) {
  let score = 0;
  const rowTitle = normalizeTitle(row.movieNm);
  const original = normalizeTitle(candidate.original_title);
  const title = normalizeTitle(candidate.title);
  if (rowTitle && (rowTitle === title || rowTitle === original)) score += 70;
  const openYear = String(row.openDt || row.prdtYear || '').slice(0, 4);
  const candidateYear = String(candidate.release_date || '').slice(0, 4);
  if (openYear && candidateYear && openYear === candidateYear) score += 25;
  if (candidate.poster_path || candidate.backdrop_path) score += 5;
  return score;
}

async function resolveTmdb(row, mapping, catalogById) {
  const code = String(row.movieCd || '');
  const existing = mapping[code];
  if (existing?.tmdbId) {
    const cached = catalogById.get(String(existing.tmdbId));
    if (cached) return { tmdbId: String(existing.tmdbId), movie: cached, reused: true };
    try {
      const detail = await tmdb(`/movie/${existing.tmdbId}`, { language: LANGUAGE });
      return { tmdbId: String(existing.tmdbId), movie: detail, reused: true };
    } catch { /* rematch below */ }
  }
  const search = await tmdb('/search/movie', { query: row.movieNm, language: LANGUAGE, region: REGION, include_adult: false, page: 1 });
  const candidates = (search.results || []).map((movie) => ({ movie, score: scoreCandidate(movie, row) })).sort((a, b) => b.score - a.score);
  const best = candidates[0]?.score >= 55 ? candidates[0].movie : null;
  if (!best) {
    mapping[code] = { tmdbId: null, title: row.movieNm, year: String(row.openDt || row.prdtYear || '').slice(0,4) || null, lastTriedAt: new Date().toISOString() };
    return { tmdbId: null, movie: null, reused: false };
  }
  mapping[code] = { tmdbId: String(best.id), title: row.movieNm, year: String(row.openDt || row.prdtYear || '').slice(0,4) || null, matchedAt: new Date().toISOString() };
  return { tmdbId: String(best.id), movie: best, reused: false };
}

function image(pathname, size) { return pathname ? `https://image.tmdb.org/t/p/${size}${pathname}` : null; }
function baseKobisRecord(row, source) {
  const releaseDate = isoFromCompact(row.openDt);
  return {
    id: `kobis:${row.movieCd}`,
    tmdbId: null,
    kobisMovieCd: String(row.movieCd || ''),
    title: row.movieNm || '제목 없음',
    originalTitle: row.movieNmEn || '',
    year: releaseDate?.slice(0,4) || String(row.prdtYear || '').slice(0,4) || null,
    releaseDate,
    theatricalReleaseDate: releaseDate,
    director: kobisDirector(row),
    posterUrl: null,
    backdropUrl: null,
    overview: '',
    source,
    externalOnly: true,
    detailLoaded: false,
  };
}
function enrichKobisRecord(row, resolved, source) {
  const base = baseKobisRecord(row, source);
  const movie = resolved?.movie;
  if (!movie || !resolved.tmdbId) return base;
  const catalogShape = movie.posterUrl !== undefined;
  return {
    ...base,
    id: String(resolved.tmdbId),
    tmdbId: String(resolved.tmdbId),
    title: movie.title || base.title,
    originalTitle: movie.originalTitle || movie.original_title || base.originalTitle,
    year: base.year || movie.year || String(movie.releaseDate || movie.release_date || '').slice(0,4) || null,
    releaseDate: base.releaseDate || movie.releaseDate || movie.release_date || null,
    director: base.director || movie.director || '',
    overview: movie.overview || '',
    voteAverage: movie.voteAverage ?? movie.vote_average ?? null,
    voteCount: movie.voteCount ?? movie.vote_count ?? 0,
    popularity: movie.popularity ?? 0,
    posterUrl: catalogShape ? (movie.posterUrl || null) : image(movie.poster_path, 'w500'),
    backdropUrl: catalogShape ? (movie.backdropUrl || null) : image(movie.backdrop_path, 'w1280'),
    source,
    externalOnly: false,
  };
}

async function fetchBoxOfficeRows() {
  const targetDt = kstParts(-1).compact;
  const payload = await kobis('boxoffice/searchDailyBoxOfficeList.json', { targetDt });
  return { targetDt, rows: (payload?.boxOfficeResult?.dailyBoxOfficeList || []).slice(0, 10) };
}

async function fetchUpcomingRows() {
  const openStartDt = addDaysCompact(0);
  const openEndDt = addDaysCompact(120);
  const rows = [];
  for (let curPage = 1; curPage <= 3; curPage++) {
    const payload = await kobis('movie/searchMovieList.json', { curPage, itemPerPage: 100, openStartDt, openEndDt });
    const result = payload?.movieListResult || {};
    rows.push(...(result.movieList || []));
    const total = Number(result.totCnt || rows.length);
    if (rows.length >= total) break;
  }
  const today = kstParts(0).compact;
  const seen = new Set();
  return rows.filter((row) => /^\d{8}$/.test(String(row.openDt || '')) && String(row.openDt) >= today)
    .sort((a, b) => String(a.openDt).localeCompare(String(b.openDt)) || String(a.movieNm).localeCompare(String(b.movieNm), 'ko'))
    .filter((row) => !seen.has(String(row.movieCd)) && seen.add(String(row.movieCd)))
    .slice(0, 60);
}

const [mapping, catalog] = await Promise.all([readJson(MAP_FILE, {}), readJson(CATALOG_FILE, { movies: [] })]);
const catalogById = new Map((catalog.movies || []).map((movie) => [String(movie.id), movie]));
console.log('Fetching KOBIS theatrical snapshots…');
const [{ targetDt, rows: boxRows }, upcomingRows] = await Promise.all([fetchBoxOfficeRows(), fetchUpcomingRows()]);
const allRows = [...boxRows, ...upcomingRows];
const unique = new Map(allRows.map((row) => [String(row.movieCd), row]));
const resolved = new Map();
for (const [code, result] of (await pool([...unique.values()], 4, async (row) => [String(row.movieCd), await resolveTmdb(row, mapping, catalogById)]))) resolved.set(code, result);

const boxOffice = boxRows.map((row) => ({
  ...enrichKobisRecord(row, resolved.get(String(row.movieCd)), 'kobis-boxoffice-snapshot'),
  boxOfficeRank: Number(row.rank) || null,
  boxOfficeAudience: Number(row.audiAcc) || null,
  theatricalStatus: 'now',
}));
const upcoming = upcomingRows.map((row) => enrichKobisRecord(row, resolved.get(String(row.movieCd)), 'kobis-upcoming-snapshot'));
const snapshot = {
  version: '0.4.5.8', region: REGION, mode: 'kobis-snapshot', updatedAt: new Date().toISOString(), targetDt,
  sources: { boxOffice: 'KOBIS daily box office', upcoming: 'KOBIS movie list · KR opening dates', enrichment: 'TMDB' },
  boxOffice,
  upcoming,
};

await fs.writeFile(MAP_FILE, `${JSON.stringify(mapping, null, 2)}\n`);
await fs.writeFile(OUT_JSON, `${JSON.stringify(snapshot, null, 2)}\n`);
await fs.writeFile(OUT_JS, `window.KINOSIS_THEATRICAL = ${JSON.stringify(snapshot, null, 2)};\n`);
await fs.writeFile(OUT_MJS, `export default ${JSON.stringify(snapshot, null, 2)};\n`);
console.log(`theatrical: KOBIS ${boxOffice.length} box office + ${upcoming.length} upcoming, ${Object.keys(mapping).length} identity mappings.`);
