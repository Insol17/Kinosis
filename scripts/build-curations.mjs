import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = path.join(root, 'content', 'curations');
const dataRoot = path.join(root, 'data');
const surfaces = ['discover', 'arthouse', 'both'];
const validateOnly = process.argv.includes('--validate-only');

function fail(message) {
  throw new Error(`[curations] ${message}`);
}

function cleanText(value, field, file, max = 500) {
  if (value == null) return '';
  if (typeof value !== 'string') fail(`${file}: ${field} must be a string`);
  const text = value.trim();
  if (text.length > max) fail(`${file}: ${field} exceeds ${max} characters`);
  return text;
}

function slugFromFile(fileName) {
  return fileName.replace(/\.curation\.json$/i, '').trim();
}

function validateSlug(slug, file) {
  if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(slug)) {
    fail(`${file}: slug must be 2-63 chars of lowercase letters, numbers, and hyphens`);
  }
}

function normalizeMovie(value, file, index) {
  if (typeof value === 'number' || typeof value === 'string') {
    const id = String(value).trim();
    if (!/^\d+$/.test(id)) fail(`${file}: movies[${index}] must be a TMDB movie id`);
    return { id };
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${file}: movies[${index}] must be an id or object`);
  const id = String(value.tmdbId ?? value.id ?? '').trim();
  if (!/^\d+$/.test(id)) fail(`${file}: movies[${index}].tmdbId must be a TMDB movie id`);
  return {
    id,
    note: cleanText(value.note, `movies[${index}].note`, file, 220),
  };
}

function readCurations() {
  const items = [];
  const seen = new Set();
  for (const surface of surfaces) {
    const dir = path.join(sourceRoot, surface);
    if (!fs.existsSync(dir)) continue;
    const files = fs.readdirSync(dir).filter((name) => name.endsWith('.curation.json')).sort();
    for (const name of files) {
      const filePath = path.join(dir, name);
      const relative = path.relative(root, filePath).replaceAll('\\', '/');
      let raw;
      try { raw = JSON.parse(fs.readFileSync(filePath, 'utf8')); }
      catch (error) { fail(`${relative}: invalid JSON (${error.message})`); }
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail(`${relative}: root must be an object`);
      if (raw.enabled === false || raw.status === 'draft') continue;
      const slug = cleanText(raw.slug, 'slug', relative, 63) || slugFromFile(name);
      validateSlug(slug, relative);
      if (seen.has(slug)) fail(`${relative}: duplicate slug '${slug}'`);
      seen.add(slug);
      const title = cleanText(raw.title, 'title', relative, 90);
      if (!title) fail(`${relative}: title is required`);
      const movies = Array.isArray(raw.movies) ? raw.movies.map((movie, index) => normalizeMovie(movie, relative, index)) : [];
      if (!movies.length) fail(`${relative}: movies must contain at least one TMDB id`);
      if (movies.length > 80) fail(`${relative}: a curation can contain at most 80 movies`);
      const uniqueMovies = [];
      const ids = new Set();
      for (const movie of movies) {
        if (ids.has(movie.id)) fail(`${relative}: duplicate TMDB movie id ${movie.id}`);
        ids.add(movie.id);
        uniqueMovies.push(movie);
      }
      const heroMovieId = String(raw.heroMovieId ?? uniqueMovies[0]?.id ?? '');
      if (!ids.has(heroMovieId)) fail(`${relative}: heroMovieId must also exist in movies`);
      items.push({
        slug,
        surface,
        eyebrow: cleanText(raw.eyebrow, 'eyebrow', relative, 50) || 'KINOSIS CURATION',
        title,
        subtitle: cleanText(raw.subtitle, 'subtitle', relative, 120),
        description: cleanText(raw.description, 'description', relative, 600),
        credit: cleanText(raw.credit, 'credit', relative, 120),
        heroMovieId,
        priority: Math.max(-9999, Math.min(9999, Number.isFinite(Number(raw.priority)) ? Math.trunc(Number(raw.priority)) : 100)),
        movies: uniqueMovies,
      });
    }
  }
  items.sort((a, b) => a.priority - b.priority || a.title.localeCompare(b.title, 'ko'));
  return items;
}

const items = readCurations();
const payload = {
  version: '0.4.3.2',
  items,
};

if (!validateOnly) {
  fs.mkdirSync(dataRoot, { recursive: true });
  fs.writeFileSync(path.join(dataRoot, 'curations.json'), `${JSON.stringify(payload, null, 2)}\n`);
  fs.writeFileSync(path.join(dataRoot, 'curations.js'), `window.KINOSIS_CURATIONS = ${JSON.stringify(payload, null, 2)};\n`);
}

console.log(`curations: ${items.length} published definition(s) ${validateOnly ? 'validated' : 'built'}`);
