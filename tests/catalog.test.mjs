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
for (const key of ['trending', 'theatres', 'streaming', 'rated']) {
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
console.log(`catalog.test: ${catalog.movies.length} movies OK`);
