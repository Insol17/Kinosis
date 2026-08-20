import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const CONTENT = path.join(ROOT, 'content/curations');
const TOKEN = process.env.TMDB_READ_ACCESS_TOKEN?.trim();
const ifKey = process.argv.includes('--if-key');
if (!TOKEN) {
  if (ifKey) { console.log('director snapshots: TMDB key absent; keeping committed snapshots.'); process.exit(0); }
  throw new Error('TMDB_READ_ACCESS_TOKEN is required.');
}
const headers = { Authorization: `Bearer ${TOKEN}`, accept: 'application/json' };
const LANGUAGE = 'ko-KR';
const image = (value, size) => value ? `https://image.tmdb.org/t/p/${size}${value}` : null;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function tmdb(endpoint, params = {}, attempt = 0) {
  const url = new URL(`https://api.themoviedb.org/3${endpoint}`);
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(9000) });
  if (response.ok) return response.json();
  if ((response.status === 429 || response.status >= 500) && attempt < 3) { await sleep(500 * 2 ** attempt); return tmdb(endpoint, params, attempt + 1); }
  throw new Error(`TMDB ${response.status}: ${url.pathname}`);
}
async function pool(items, size, mapper) {
  const out = new Array(items.length); let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => {
    while (true) { const index = cursor++; if (index >= items.length) return; try { out[index] = await mapper(items[index]); } catch (error) { console.warn(`director snapshot item failed: ${error.message}`); } }
  }));
  return out.filter(Boolean);
}
function snapshotRow(row, person) {
  return {
    id: String(row.id), title: row.title || row.original_title || 'Untitled', originalTitle: row.original_title || '',
    year: String(row.release_date || '').slice(0,4) || null, releaseDate: row.release_date || null,
    director: person.name || '', directorId: String(person.id || ''), runtime: Number(row.runtime || 0) || null,
    posterUrl: image(row.poster_path, 'w500'), backdropUrl: image(row.backdrop_path, 'w1280'), overview: row.overview || '',
  };
}

const files = (await fs.readdir(CONTENT)).filter((name) => name.endsWith('.curation.json'));
let changed = 0;
for (const name of files) {
  const file = path.join(CONTENT, name);
  const raw = JSON.parse(await fs.readFile(file, 'utf8'));
  if (raw.kind !== 'director-archive' || raw.source?.type !== 'director') continue;
  const personId = String(raw.source.personId || '').trim();
  if (!/^\d+$/.test(personId)) { console.warn(`${name}: no stable personId; snapshot skipped.`); continue; }
  try {
    const [person, credits] = await Promise.all([tmdb(`/person/${personId}`, { language: LANGUAGE }), tmdb(`/person/${personId}/movie_credits`, { language: LANGUAGE })]);
    let rows = (credits.crew || []).filter((row) => row.job === 'Director' && row.id && row.release_date);
    const include = new Set((raw.source.include || []).map(String));
    const exclude = new Set((raw.source.exclude || []).map(String));
    rows = rows.filter((row) => !exclude.has(String(row.id)));
    if (include.size) rows = rows.filter((row) => include.has(String(row.id)) || !exclude.has(String(row.id)));
    if (raw.source.mode === 'solo-features') {
      rows = await pool(rows, 4, async (row) => {
        const detail = await tmdb(`/movie/${row.id}`, { language: LANGUAGE });
        return Number(detail.runtime || 0) >= 60 ? { ...row, ...detail } : null;
      });
    }
    const dedupe = new Map();
    for (const row of rows) dedupe.set(String(row.id), row);
    rows = [...dedupe.values()].sort((a,b) => String(a.release_date || '').localeCompare(String(b.release_date || '')) || Number(a.id) - Number(b.id));
    const snapshot = rows.map((row) => snapshotRow(row, person));
    const previous = Array.isArray(raw.source.snapshot) ? raw.source.snapshot : [];
    const previousSignature = previous.map((row) => `${row.id}:${row.posterUrl || ''}:${row.backdropUrl || ''}`).join('|');
    const nextSignature = snapshot.map((row) => `${row.id}:${row.posterUrl || ''}:${row.backdropUrl || ''}`).join('|');
    if (previousSignature !== nextSignature) changed++;
    raw.source.name = person.name || raw.source.name;
    raw.source.personId = String(person.id || personId);
    raw.source.snapshot = snapshot;
    raw.source.snapshotGeneratedAt = new Date().toISOString();
    await fs.writeFile(file, `${JSON.stringify(raw, null, 2)}\n`);
    console.log(`${name}: ${snapshot.length} directed film(s) snapshotted.`);
  } catch (error) {
    console.warn(`${name}: snapshot refresh failed; committed snapshot retained (${error.message}).`);
  }
}
console.log(`director snapshots: ${changed} definition(s) changed.`);
