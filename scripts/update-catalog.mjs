import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const TOKEN = process.env.TMDB_READ_ACCESS_TOKEN;
if (!TOKEN) throw new Error('TMDB_READ_ACCESS_TOKEN is required. Keep it in GitHub Actions Secrets; never place it in frontend code.');

const API = 'https://api.themoviedb.org/3';
const REGION = process.env.KINOSIS_REGION || process.env.FILM_REGION || 'KR';
const LANGUAGE = process.env.KINOSIS_LANGUAGE || process.env.FILM_LANGUAGE || 'ko-KR';
const ROOT = process.cwd();
const JSON_OUT = path.join(ROOT, 'data/catalog.json');
const JS_OUT = path.join(ROOT, 'data/catalog.js');
const META_OUT = path.join(ROOT, 'data/meta.json');
const headers = { Authorization: `Bearer ${TOKEN}`, accept: 'application/json' };

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function tmdb(endpoint, params = {}, attempt = 0) {
  const url = new URL(API + endpoint);
  Object.entries(params).forEach(([k,v]) => { if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v)); });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, { headers, signal: controller.signal });
    if (res.ok) return await res.json();
    if ((res.status === 429 || res.status >= 500) && attempt < 4) {
      const retryAfter = Number(res.headers.get('retry-after'));
      const delay = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : Math.min(8000, 600 * 2 ** attempt + Math.random() * 250);
      console.warn(`TMDB ${res.status} ${url.pathname}; retrying in ${Math.round(delay)}ms`);
      await sleep(delay);
      return tmdb(endpoint, params, attempt + 1);
    }
    const body = (await res.text()).slice(0, 400);
    throw new Error(`TMDB ${res.status} ${url.pathname}: ${body}`);
  } finally { clearTimeout(timer); }
}

function uniq(items) {
  const seen = new Set();
  return items.filter(m => m?.id && !seen.has(m.id) && seen.add(m.id));
}
function providerRows(kr, imageBase) {
  if (!kr) return [];
  const groups = [['flatrate','subscription'],['free','free'],['ads','ads'],['rent','rent'],['buy','buy']];
  const rows = [];
  for (const [source,type] of groups) for (const p of kr[source] || []) rows.push({
    id:p.provider_id, name:p.provider_name, type,
    logoUrl:p.logo_path ? `${imageBase}w92${p.logo_path}` : null
  });
  return rows.filter((r,i,a) => a.findIndex(x => x.id === r.id && x.type === r.type) === i);
}
async function pool(items, size, mapper) {
  const out = new Array(items.length); let cursor = 0;
  await Promise.all(Array.from({length:Math.min(size,items.length)}, async () => {
    while (true) {
      const i = cursor++; if (i >= items.length) return;
      try { out[i] = await mapper(items[i]); }
      catch (e) { console.warn(`Skipping movie ${items[i]?.id}: ${e.message}`); out[i] = null; }
    }
  }));
  return out.filter(Boolean);
}
function clean(s){ return typeof s === 'string' ? s.trim() : ''; }
function imageScore(image, preferredLanguage = false) {
  const votes = Math.min(Number(image?.vote_count || 0), 50);
  const avg = Number(image?.vote_average || 0);
  const width = Math.min(Number(image?.width || 0) / 1000, 4);
  return avg * 10 + votes + width + (preferredLanguage ? 8 : 0);
}
function pickHeroBackdrop(images, fallbackPath, imageBase) {
  const candidates = (images?.backdrops || [])
    .filter(x => x?.file_path && Number(x.width || 0) >= 1000 && Number(x.aspect_ratio || 0) >= 1.6 && Number(x.aspect_ratio || 0) <= 2.15)
    .sort((a,b) => imageScore(b, b.iso_639_1 == null) - imageScore(a, a.iso_639_1 == null));
  const path = candidates[0]?.file_path || fallbackPath;
  return path ? `${imageBase}w1280${path}` : null;
}
function pickLogo(images, imageBase) {
  const langRank = lang => lang === 'ko' ? 3 : lang === 'en' ? 2 : lang == null ? 1 : 0;
  const candidates = (images?.logos || []).filter(x => x?.file_path).sort((a,b) => {
    const language = langRank(b.iso_639_1) - langRank(a.iso_639_1);
    return language || imageScore(b, true) - imageScore(a, true);
  });
  return candidates[0]?.file_path ? `${imageBase}original${candidates[0].file_path}` : null;
}

async function atomicReplace(filePath, content) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const temp = `${filePath}.tmp-${process.pid}`;
  const backup = `${filePath}.bak`;
  await fs.writeFile(temp, content, 'utf8');
  try {
    await fs.rm(backup, { force:true });
    try { await fs.rename(filePath, backup); } catch (e) { if (e.code !== 'ENOENT') throw e; }
    await fs.rename(temp, filePath);
    await fs.rm(backup, { force:true });
  } catch (e) {
    await fs.rm(temp, { force:true });
    try { await fs.access(backup); await fs.rename(backup, filePath); } catch {}
    throw e;
  }
}

console.log('Fetching TMDB configuration and KR lists…');
const config = await tmdb('/configuration');
const imageBase = config?.images?.secure_base_url || 'https://image.tmdb.org/t/p/';

const [nowPlaying, trending, topRated, streaming] = await Promise.all([
  tmdb('/movie/now_playing', { language:LANGUAGE, region:REGION, page:1 }),
  tmdb('/trending/movie/week', { language:LANGUAGE }),
  tmdb('/movie/top_rated', { language:LANGUAGE, region:REGION, page:1 }),
  tmdb('/discover/movie', {
    language:LANGUAGE, region:REGION, watch_region:REGION,
    with_watch_monetization_types:'flatrate', include_adult:false, include_video:false,
    sort_by:'popularity.desc', page:1
  })
]);

const rawSections = {
  theatres:(nowPlaying.results || []).slice(0,24),
  trending:(trending.results || []).slice(0,24),
  rated:(topRated.results || []).filter(m => Number(m.vote_count || 0) >= 250).slice(0,24),
  streaming:(streaming.results || []).slice(0,24)
};
const rawMovies = uniq(Object.values(rawSections).flat());
if (rawMovies.length < 12) throw new Error(`Validation failed before enrichment: only ${rawMovies.length} unique movies.`);
// Only the few movies that can become a Discover hero need the heavier images query.
// This keeps the weekly refresh inexpensive while still giving banner-quality art and title logos.
const heroCandidateIds = new Set(Object.values(rawSections).flatMap(list => (list || []).slice(0,3)).map(m => Number(m.id)));

console.log(`Enriching ${rawMovies.length} movies…`);
const enriched = await pool(rawMovies, 4, async base => {
  const needsHeroImages = heroCandidateIds.has(Number(base.id));
  const [detail, providers, external, images] = await Promise.all([
    tmdb(`/movie/${base.id}`, { language:LANGUAGE, append_to_response:'credits' }),
    tmdb(`/movie/${base.id}/watch/providers`),
    tmdb(`/movie/${base.id}/external_ids`),
    needsHeroImages ? tmdb(`/movie/${base.id}/images`, { include_image_language:'ko,en,null' }) : Promise.resolve(null)
  ]);
  const director = detail.credits?.crew?.find(p => p.job === 'Director')?.name || '';
  const kr = providers.results?.[REGION];
  return {
    id:detail.id,
    title:detail.title || base.title || '',
    originalTitle:detail.original_title || base.original_title || '',
    year:detail.release_date ? Number(detail.release_date.slice(0,4)) : null,
    releaseDate:detail.release_date || null,
    director,
    runtime:Number(detail.runtime || 0) || null,
    genres:(detail.genres || []).map(g => g.name),
    voteAverage:Number(detail.vote_average || 0), voteCount:Number(detail.vote_count || 0),
    popularity:Number(detail.popularity || base.popularity || 0),
    overview:clean(detail.overview || base.overview),
    tagline:clean(detail.tagline),
    posterUrl:detail.poster_path ? `${imageBase}w500${detail.poster_path}` : null,
    backdropUrl:detail.backdrop_path ? `${imageBase}w1280${detail.backdrop_path}` : (detail.poster_path ? `${imageBase}w780${detail.poster_path}` : null),
    heroBackdropUrl:needsHeroImages ? pickHeroBackdrop(images, detail.backdrop_path, imageBase) : null,
    logoUrl:needsHeroImages ? pickLogo(images, imageBase) : null,
    providers:providerRows(kr, imageBase),
    watchLink:kr?.link || null,
    tmdbUrl:`https://www.themoviedb.org/movie/${detail.id}`,
    imdbId:external.imdb_id || null,
    demo:false
  };
});

const byId = new Map(enriched.map(m => [m.id,m]));
const materialize = list => list.map(x => byId.get(x.id)).filter(Boolean);
const sections = Object.fromEntries(Object.entries(rawSections).map(([k,v]) => [k, materialize(v)]));
const featuredPool = uniq([...sections.trending,...sections.streaming,...sections.theatres]);
const featuredScore = m => Number(m.popularity || 0) + Math.min(Number(m.voteCount || 0) / 12, 260) + Number(m.voteAverage || 0) * 18;
const streamableHero = featuredPool
  .filter(m => (m.heroBackdropUrl || m.backdropUrl) && m.overview && (m.providers || []).some(p => p.type === 'subscription'))
  .sort((a,b) => featuredScore(b) - featuredScore(a))[0];
const visualHero = featuredPool
  .filter(m => (m.heroBackdropUrl || m.backdropUrl) && m.overview)
  .sort((a,b) => featuredScore(b) - featuredScore(a))[0];
const featured = streamableHero || visualHero || enriched[0];
const catalog = {
  version:2, updatedAt:new Date().toISOString(), region:REGION, language:LANGUAGE, mode:'live',
  sources:{
    metadata:{name:'TMDB',active:true},
    streaming:{name:'JustWatch via TMDB',active:true},
    theatrical:{name:`TMDB now_playing (${REGION})`,active:true}
  },
  featured, movies:enriched, sections
};

// Guard against a bad API response replacing the last known-good catalog.
const required = ['theatres','trending','streaming','rated'];
for (const key of required) if (!Array.isArray(catalog.sections[key]) || catalog.sections[key].length < 3) throw new Error(`Validation failed: section ${key} has ${catalog.sections[key]?.length || 0} movies.`);
if (!catalog.featured?.id || catalog.movies.length < 12) throw new Error('Validation failed: featured/movie count missing.');

const json = JSON.stringify(catalog,null,2) + '\n';
JSON.parse(json); // syntax validation before replacement
await atomicReplace(JSON_OUT, json);
await atomicReplace(JS_OUT, `window.KINOSIS_CATALOG = ${json.trim()};\n`);
await atomicReplace(META_OUT, JSON.stringify({
  status:'ok', mode:'live', updatedAt:catalog.updatedAt, region:REGION,
  counts:Object.fromEntries(required.map(k => [k,catalog.sections[k].length])),
  sources:catalog.sources
},null,2) + '\n');
console.log(`Catalog updated safely: ${catalog.movies.length} movies.`);
