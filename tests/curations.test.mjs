import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataPath = path.join(root, 'data', 'curations.json');
const scriptPath = path.join(root, 'data', 'curations.js');
const builder = path.join(root, 'scripts', 'build-curations.mjs');
const sourceDir = path.join(root, 'content', 'curations');
const fixturePath = path.join(sourceDir, '__test__.curation.json');

function build() {
  execFileSync(process.execPath, [builder], { cwd: root, stdio: 'pipe' });
  return JSON.parse(fs.readFileSync(dataPath, 'utf8'));
}


const helperSource = fs.readFileSync(path.join(root, 'assets', 'js', 'curations.js'), 'utf8');
const sandbox = { window: { KINOSIS_CURATIONS: { version: 'test', items: [
  { slug: 'discover-one', surface: 'discover', priority: 20 },
  { slug: 'both-one', surface: 'both', priority: 10 },
  { slug: 'arthouse-one', surface: 'arthouse', priority: 5 },
] } } };
vm.createContext(sandbox);
vm.runInContext(helperSource, sandbox);
assert.deepEqual(Array.from(sandbox.window.KINOSIS_CURATIONS_API.forSurface('discover'), (item) => item.slug), ['both-one', 'discover-one']);
assert.deepEqual(Array.from(sandbox.window.KINOSIS_CURATIONS_API.forSurface('arthouse'), (item) => item.slug), ['arthouse-one', 'both-one']);

const baseline = build();
assert.equal(baseline.version, '0.4.5.4');
assert.ok(Array.isArray(baseline.items));
assert.ok(fs.readFileSync(scriptPath, 'utf8').startsWith('window.KINOSIS_CURATIONS = '));

const catalog = JSON.parse(fs.readFileSync(path.join(root, 'data', 'catalog.json'), 'utf8'));
const ids = (catalog.movies || []).slice(0, 2).map((movie) => String(movie.id));
assert.equal(ids.length, 2, 'catalog fixture needs two movie ids');

fs.writeFileSync(fixturePath, `${JSON.stringify({
  eyebrow: 'TEST CURATION',
  title: 'Build Pipeline Test',
  description: 'Temporary test definition.',
  priority: -999,
  heroMovieId: ids[0],
  movies: ids,
}, null, 2)}\n`);

try {
  const withFixture = build();
  const fixture = withFixture.items.find((item) => item.slug === '__test__');
  // Leading underscore is intentionally invalid; rename fixture to a valid slug if validation is working.
  assert.equal(fixture, undefined);
  assert.fail('invalid slug fixture unexpectedly passed validation');
} catch (error) {
  assert.match(String(error.stderr || error.message || error), /invalid slug/);
} finally {
  fs.rmSync(fixturePath, { force: true });
}

const validFixturePath = path.join(sourceDir, 'test-build.curation.json');
fs.writeFileSync(validFixturePath, `${JSON.stringify({
  eyebrow: 'TEST CURATION',
  title: 'Build Pipeline Test',
  description: 'Temporary test definition.',
  priority: -999,
  heroMovieId: ids[0],
  movies: ids,
}, null, 2)}\n`);

try {
  const withFixture = build();
  const fixture = withFixture.items.find((item) => item.slug === 'test-build');
  assert.ok(fixture, 'valid curation was not indexed');
  assert.equal(fixture.surface, 'arthouse');
  assert.equal(fixture.kind, 'editorial');
  assert.deepEqual(fixture.movies.map((movie) => movie.id), ids);
} finally {
  fs.rmSync(validFixturePath, { force: true });
  build();
}

const finalPayload = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
assert.equal(finalPayload.items.length, baseline.items.length, 'test fixture leaked into generated curation data');
assert.ok(finalPayload.items.some((item) => item.slug === 'kiarostami' && item.kind === 'director-archive' && item.source?.type === 'director'), 'director archive missing');
assert.ok(finalPayload.items.some((item) => item.slug === 'christian-petzold'), 'Christian Petzold director archive missing');
const archives = finalPayload.items.filter((item) => item.kind === 'director-archive');
assert.ok(archives.every((item) => /^\d+$/.test(String(item.source?.personId || ''))), 'director archives must ship a stable TMDB personId');
assert.ok(archives.every((item) => Array.isArray(item.source?.snapshot) && item.source.snapshot.length > 0), 'director archives must ship snapshot fallback rows');
assert.ok(archives.every((item) => item.source.snapshot.every((movie) => movie.director && movie.directorId)), 'snapshot movies must carry director identity');
assert.ok(!finalPayload.items.some((item) => item.slug === 'tarantino'), 'broad mainstream Tarantino archive should not remain in Arthouse programme');
const erice = finalPayload.items.find((item) => item.slug === 'victor-erice');
assert.equal(erice?.source?.mode, 'solo-features', 'Víctor Erice curation should resolve solo feature films only');
console.log(`curations.test: build indexing + validation OK (${finalPayload.items.length} published definition(s))`);
