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
const create = sandbox.window.KINOSIS_CURATION_LOADER.create;

let fetchCount = 0;
const loader = create({
  fetchDirector: async () => { fetchCount += 1; return [{ id: '1', title: 'Live 1' }, { id: '2', title: 'Live 2' }]; },
  fallbackDirector: async () => [], normalizeRows: (rows) => rows,
});
const item = { slug: 'kiarostami', source: { type: 'director', personId: '119294', snapshot: [{ id: '9', title: 'Snapshot' }], snapshotGeneratedAt: '2026-08-20' } };
assert.equal(loader.seed(item).length, 1, 'snapshot must paint synchronously before network');
assert.equal(loader.state(item.slug).source, 'snapshot');
const first = await loader.ensure(item);
assert.equal(first.status, 'ready'); assert.equal(fetchCount, 1); assert.equal(first.rows.length, 2); assert.equal(loader.state(item.slug).source, 'live');
const second = await loader.ensure(item);
assert.equal(second.changed, false); assert.equal(fetchCount, 1, 'live-ready cache must not refetch');

let resolveSlow; let concurrentCount = 0;
const concurrent = create({
  fetchDirector: () => { concurrentCount += 1; return new Promise((resolve) => { resolveSlow = resolve; }); },
  fallbackDirector: async () => [], normalizeRows: (rows) => rows,
});
const concurrentItem = { slug: 'erice', source: { type: 'director', snapshot: [{ id: '7' }] } };
const a = concurrent.ensure(concurrentItem); const b = concurrent.ensure(concurrentItem);
assert.equal(concurrentCount, 1, 'concurrent calls must share one request');
resolveSlow([{ id: '8' }]);
await Promise.all([a,b]); assert.equal(concurrentCount, 1);

let fail = true; let retryCount = 0;
const resilient = create({
  fetchDirector: async () => { retryCount += 1; if (fail) throw new Error('network'); return [{ id: '22', title: 'Recovered' }]; },
  fallbackDirector: async () => [], normalizeRows: (rows) => rows,
});
const resilientItem = { slug: 'petzold', source: { type: 'director', snapshot: [{ id: '21', title: 'Snapshot Petzold' }] } };
resilient.seed(resilientItem);
const failed = await resilient.ensure(resilientItem);
assert.equal(failed.status, 'error');
assert.equal(resilient.peek('petzold')[0].id, '21', 'network failure must retain snapshot rather than cache []');
assert.equal(resilient.state('petzold').status, 'error');
const cachedError = await resilient.ensure(resilientItem);
assert.equal(cachedError.status, 'error');
assert.equal(retryCount, 1, 'error state must remain stable until an explicit retry instead of auto-looping on rerender');
fail = false;
const recovered = await resilient.retry(resilientItem);
assert.equal(recovered.status, 'ready'); assert.equal(resilient.peek('petzold')[0].id, '22'); assert.equal(retryCount, 2);

console.log('curation-loader.test: snapshot-first + state machine + retry + request dedupe OK');
