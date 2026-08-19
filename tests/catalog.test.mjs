import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(root, 'data/catalog.js'), 'utf8');
const context = { window: {} };
vm.createContext(context);
vm.runInContext(source, context);
const catalog = context.window.KINOSIS_CATALOG;

assert.ok(catalog, 'window.KINOSIS_CATALOG must exist');
assert.ok(Array.isArray(catalog.movies), 'catalog.movies must be an array');
assert.ok(catalog.sections && typeof catalog.sections === 'object', 'catalog.sections must exist');
for (const key of ['boxOffice', 'upcoming', 'trending', 'theatres', 'streaming', 'rated']) {
  assert.ok(Array.isArray(catalog.sections[key]), `catalog.sections.${key} must be an array`);
}
for (const movie of catalog.movies) {
  assert.ok(movie.id !== undefined && movie.id !== null, 'movie id required');
  assert.ok(typeof movie.title === 'string' && movie.title.trim(), 'movie title required');
  if (movie.providers) {
    for (const provider of movie.providers) {
      assert.ok(typeof provider.name === 'string', 'provider name required');
      assert.ok(['subscription','free','ads','rent','buy'].includes(provider.type), `unknown provider type: ${provider.type}`);
    }
  }
}

for (const key of ['boxOffice','theatres','rated']) {
  assert.ok(catalog.sections[key].length >= 7, `catalog.sections.${key} should fill the seven-card rail`);
}
for (const [key, rows] of Object.entries(catalog.sections)) {
  const ids = new Set();
  const identities = new Set();
  for (const row of rows || []) {
    const id = String(row.id);
    const title = String(row.originalTitle || row.title || '').normalize('NFKC').toLowerCase().replace(/[^a-z0-9가-힣]+/g, '');
    const year = String(row.year || row.releaseDate || '').slice(0,4);
    const identity = title && year ? `${title}|${year}` : '';
    assert.ok(!ids.has(id), `${key} contains duplicate movie id ${id}`);
    assert.ok(!identity || !identities.has(identity), `${key} contains duplicate movie identity ${identity}`);
    ids.add(id); if (identity) identities.add(identity);
  }
}
if (catalog.sections.upcoming.length < 7) {
  const appSource = fs.readFileSync(path.join(root, 'assets/js/app.js'), 'utf8');
  assert.ok(appSource.includes('/api/upcoming'), 'thin bundled upcoming catalog requires live KR theatrical fallback');
}

console.log(`catalog.test: ${catalog.movies.length} movies OK`);
