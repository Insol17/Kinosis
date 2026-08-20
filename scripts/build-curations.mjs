import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = path.join(root, 'content', 'curations');
const dataRoot = path.join(root, 'data');
const validateOnly = process.argv.includes('--validate-only');
const fail = (message) => { throw new Error(`[curations] ${message}`); };
const text = (value, field, file, max = 600) => {
  if (value == null) return '';
  if (typeof value !== 'string') fail(`${file}: ${field} must be string`);
  const out = value.trim();
  if (out.length > max) fail(`${file}: ${field} too long`);
  return out;
};
const slugFile = (name) => name.replace(/\.curation\.json$/i, '');

function movie(value, file, index, field = 'movies') {
  const id = String(typeof value === 'object' ? (value.tmdbId ?? value.id ?? '') : value).trim();
  if (!/^\d+$/.test(id)) fail(`${file}: ${field}[${index}] invalid TMDB id`);
  const row = { id, note: typeof value === 'object' ? text(value.note, `${field}[${index}].note`, file, 700) : '' };
  if (typeof value === 'object' && value?.snapshot && typeof value.snapshot === 'object') row.snapshot = normalizeMovieSnapshot({ ...value.snapshot, id }, file, `${field}[${index}].snapshot`);
  return row;
}

function ids(value, field, file) {
  if (value == null) return [];
  if (!Array.isArray(value)) fail(`${file}: ${field} must be array`);
  const out = [];
  for (const raw of value) {
    const id = String(raw).trim();
    if (!/^\d+$/.test(id)) fail(`${file}: ${field} contains invalid TMDB id`);
    if (!out.includes(id)) out.push(id);
  }
  return out;
}


function normalizeMovieSnapshot(entry, file, field = 'snapshot') {
  const id = String(entry?.id ?? entry?.tmdbId ?? '').trim();
  if (!/^\d+$/.test(id)) fail(`${file}: ${field}.id invalid TMDB id`);
  const title = text(entry?.title, `${field}.title`, file, 160);
  if (!title) fail(`${file}: ${field}.title required`);
  const year = String(entry?.year || '').trim();
  return {
    id,
    title,
    originalTitle: text(entry?.originalTitle, `${field}.originalTitle`, file, 160),
    year: /^\d{4}$/.test(year) ? year : null,
    releaseDate: text(entry?.releaseDate, `${field}.releaseDate`, file, 20) || null,
    director: text(entry?.director, `${field}.director`, file, 120),
    directorId: String(entry?.directorId || '').trim(),
    runtime: Number.isFinite(Number(entry?.runtime)) ? Number(entry.runtime) : null,
    overview: text(entry?.overview, `${field}.overview`, file, 1200),
    posterUrl: text(entry?.posterUrl, `${field}.posterUrl`, file, 500) || null,
    backdropUrl: text(entry?.backdropUrl, `${field}.backdropUrl`, file, 500) || null,
    source: 'programme-snapshot',
    detailLoaded: false,
  };
}

function snapshot(value, file) {
  if (value == null) return [];
  if (!Array.isArray(value)) fail(`${file}: source.snapshot must be array`);
  const seen = new Set();
  return value.map((entry, index) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) fail(`${file}: source.snapshot[${index}] must be object`);
    const row = normalizeMovieSnapshot(entry, file, `source.snapshot[${index}]`);
    if (seen.has(row.id)) fail(`${file}: source.snapshot duplicate id ${row.id}`);
    seen.add(row.id);
    return { ...row, source: 'director-snapshot' };
  });
}

function source(value, file) {
  if (!value) return null;
  if (typeof value !== 'object' || Array.isArray(value)) fail(`${file}: source must be object`);
  if (value.type !== 'director') fail(`${file}: only source.type=director supported`);
  const name = text(value.name, 'source.name', file, 100);
  const personId = String(value.personId || '').trim();
  if (!name && !/^\d+$/.test(personId)) fail(`${file}: source.name or source.personId required`);
  return {
    type: 'director',
    name,
    personId: /^\d+$/.test(personId) ? personId : '',
    sort: value.sort === 'release_desc' ? 'release_desc' : 'release_asc',
    mode: value.mode === 'solo-features' ? 'solo-features' : 'all-directed',
    include: ids(value.include, 'source.include', file),
    exclude: ids(value.exclude, 'source.exclude', file),
    snapshot: snapshot(value.snapshot, file),
    snapshotGeneratedAt: text(value.snapshotGeneratedAt, 'source.snapshotGeneratedAt', file, 40) || null,
  };
}

function paragraphs(value, field, file) {
  if (value == null) return [];
  if (!Array.isArray(value)) fail(`${file}: ${field} must be array`);
  return value.map((entry, index) => text(entry, `${field}[${index}]`, file, 1200)).filter(Boolean).slice(0, 8);
}

function chapters(value, file) {
  if (value == null) return [];
  if (!Array.isArray(value)) fail(`${file}: chapters must be array`);
  return value.map((chapter, index) => {
    if (!chapter || typeof chapter !== 'object' || Array.isArray(chapter)) fail(`${file}: chapters[${index}] must be object`);
    const title = text(chapter.title, `chapters[${index}].title`, file, 120);
    if (!title) fail(`${file}: chapters[${index}].title required`);
    if (!Array.isArray(chapter.movies) || !chapter.movies.length) fail(`${file}: chapters[${index}].movies required`);
    return {
      title,
      description: text(chapter.description, `chapters[${index}].description`, file, 400),
      movies: chapter.movies.map((entry, movieIndex) => movie(entry, file, movieIndex, `chapters[${index}].movies`)),
    };
  });
}

function read() {
  const files = [];
  if (fs.existsSync(sourceRoot)) {
    for (const entry of fs.readdirSync(sourceRoot, { withFileTypes: true })) {
      if (entry.isFile() && entry.name.endsWith('.curation.json')) files.push(path.join(sourceRoot, entry.name));
      if (entry.isDirectory()) {
        for (const name of fs.readdirSync(path.join(sourceRoot, entry.name))) {
          if (name.endsWith('.curation.json')) files.push(path.join(sourceRoot, entry.name, name));
        }
      }
    }
  }

  const items = [];
  const seen = new Set();
  for (const filePath of files.sort()) {
    const rel = path.relative(root, filePath).replaceAll('\\', '/');
    let raw;
    try { raw = JSON.parse(fs.readFileSync(filePath, 'utf8')); }
    catch (error) { fail(`${rel}: invalid JSON (${error.message})`); }
    if (raw.enabled === false || raw.status === 'draft') continue;

    const slug = text(raw.slug, 'slug', rel, 63) || slugFile(path.basename(filePath));
    if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(slug)) fail(`${rel}: invalid slug`);
    if (seen.has(slug)) fail(`${rel}: duplicate slug`);
    seen.add(slug);

    const title = text(raw.title, 'title', rel, 120);
    if (!title) fail(`${rel}: title required`);
    const src = source(raw.source, rel);
    const kind = raw.kind === 'editorial' ? 'editorial' : raw.kind === 'director-archive' ? 'director-archive' : (src ? 'director-archive' : 'editorial');
    const movieRows = Array.isArray(raw.movies) ? raw.movies.map((entry, index) => movie(entry, rel, index)) : [];
    const chapterRows = chapters(raw.chapters, rel);
    const chapterMovieRows = chapterRows.flatMap((chapter) => chapter.movies);
    for (const entry of chapterMovieRows) if (!movieRows.some((row) => row.id === entry.id)) movieRows.push(entry);
    const explicitMovieIds = movieRows.map((entry) => entry.id);
    if (new Set(explicitMovieIds).size !== explicitMovieIds.length) fail(`${rel}: duplicate movie id across editorial definition`);

    if (kind === 'editorial' && !explicitMovieIds.length) fail(`${rel}: editorial curation requires explicit movies or chapters`);
    if (kind === 'director-archive' && !src) fail(`${rel}: director-archive requires source.type=director`);
    if (kind === 'director-archive' && !explicitMovieIds.length) fail(`${rel}: director-archive requires explicit movies`);
    if (kind === 'editorial' && movieRows.some((entry) => !entry.note)) fail(`${rel}: editorial curation requires a note for every movie`);
    if (kind === 'editorial' && src) fail(`${rel}: editorial source of truth must be explicit; remove source and list movies`);

    items.push({
      slug,
      kind,
      surface: raw.surface === 'discover' || raw.surface === 'both' ? raw.surface : 'arthouse',
      eyebrow: text(raw.eyebrow, 'eyebrow', rel, 50) || (kind === 'director-archive' ? "DIRECTOR'S ARCHIVE" : 'KINOSIS CURATION'),
      title,
      subtitle: text(raw.subtitle, 'subtitle', rel, 160),
      description: text(raw.description, 'description', rel, 800),
      introduction: [],
      credit: text(raw.credit, 'credit', rel, 120) || 'Curated by KINOSIS',
      heroMovieId: String(raw.heroMovieId || movieRows[0]?.id || chapterRows[0]?.movies[0]?.id || ''),
      heroImageUrl: text(raw.heroImageUrl, 'heroImageUrl', rel, 500),
      priority: Number.isFinite(Number(raw.priority)) ? Math.trunc(Number(raw.priority)) : 100,
      source: kind === 'director-archive' ? src : null,
      movies: movieRows,
      orderMode: raw.orderMode === 'curated' ? 'curated' : 'unordered',
      chapters: [],
    });
  }
  items.sort((a, b) => a.priority - b.priority || a.title.localeCompare(b.title, 'ko'));
  return items;
}

async function enrichProgrammeMovies(items) {
  const token = process.env.TMDB_READ_ACCESS_TOKEN || '';
  if (!token || validateOnly) return items;
  const byId = new Map();
  for (const item of items) for (const entry of item.movies || []) if (!entry.snapshot) byId.set(String(entry.id), null);
  const ids = [...byId.keys()];
  let cursor = 0;
  const workers = Array.from({ length: Math.min(4, ids.length) }, async () => {
    while (cursor < ids.length) {
      const id = ids[cursor++];
      try {
        const response = await fetch(`https://api.themoviedb.org/3/movie/${id}?language=ko-KR&append_to_response=credits`, { headers: { Authorization: `Bearer ${token}`, accept: 'application/json' } });
        if (!response.ok) continue;
        const data = await response.json();
        const director = (data.credits?.crew || []).find((person) => person.job === 'Director');
        byId.set(id, {
          id,
          title: data.title || data.original_title || `TMDB ${id}`,
          originalTitle: data.original_title || '',
          year: String(data.release_date || '').slice(0,4) || null,
          releaseDate: data.release_date || null,
          director: director?.name || '',
          directorId: director?.id ? String(director.id) : '',
          runtime: Number(data.runtime) || null,
          overview: data.overview || '',
          posterUrl: data.poster_path ? `https://image.tmdb.org/t/p/w500${data.poster_path}` : null,
          backdropUrl: data.backdrop_path ? `https://image.tmdb.org/t/p/w1280${data.backdrop_path}` : null,
          source: 'programme-snapshot', detailLoaded: false,
        });
      } catch { /* retain runtime fallback for this one film */ }
    }
  });
  await Promise.all(workers);
  return items.map((item) => ({ ...item, movies: (item.movies || []).map((entry) => ({ ...entry, snapshot: entry.snapshot || byId.get(String(entry.id)) || undefined })) }));
}

const payload = { version: '0.4.5.7', items: await enrichProgrammeMovies(read()) };
if (!validateOnly) {
  fs.mkdirSync(dataRoot, { recursive: true });
  fs.writeFileSync(path.join(dataRoot, 'curations.json'), `${JSON.stringify(payload, null, 2)}\n`);
  fs.writeFileSync(path.join(dataRoot, 'curations.js'), `window.KINOSIS_CURATIONS = ${JSON.stringify(payload, null, 2)};\n`);
}
console.log(`curations: ${payload.items.length} published definition(s) ${validateOnly ? 'validated' : 'built'}`);
