import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(root, 'assets/js/curation-loader.js'), 'utf8');
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(source, sandbox);

let fetchCount = 0;
const loader = sandbox.window.KINOSIS_CURATION_LOADER.create({
  fetchDirector: async () => { fetchCount += 1; return [{ id: '1' }, { id: '2' }]; },
  fallbackDirector: async () => [],
  normalizeRows: (rows) => rows,
});
const item = { slug: 'kiarostami', source: { type: 'director', name: 'Abbas Kiarostami' } };
const first = await loader.ensure(item);
assert.equal(first.changed, true);
assert.equal(fetchCount, 1);
assert.equal(first.rows.length, 2);
const second = await loader.ensure(item);
assert.equal(second.changed, false, 'cached ensure must not request a rerender');
assert.equal(fetchCount, 1, 'cached ensure must not fetch again');
assert.equal(loader.peek('kiarostami').length, 2);

// Concurrent callers share one fetch. This is the regression that previously caused render/ensure churn.
let resolveSlow;
let concurrentCount = 0;
const concurrent = sandbox.window.KINOSIS_CURATION_LOADER.create({
  fetchDirector: () => { concurrentCount += 1; return new Promise((resolve) => { resolveSlow = resolve; }); },
  fallbackDirector: async () => [],
  normalizeRows: (rows) => rows,
});
const a = concurrent.ensure({ slug: 'erice', source: { type: 'director' } });
const b = concurrent.ensure({ slug: 'erice', source: { type: 'director' } });
assert.equal(concurrentCount, 1);
resolveSlow([{ id: '7' }]);
const [ra, rb] = await Promise.all([a, b]);
assert.equal(ra.changed, true);
assert.equal(rb.changed, true);
assert.equal(concurrentCount, 1);
const cached = await concurrent.ensure({ slug: 'erice', source: { type: 'director' } });
assert.equal(cached.changed, false);

console.log('curation-loader.test: dynamic curation fetches once and cached reads do not rerender');
