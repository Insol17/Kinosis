import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(root, 'assets/js/state-integrity.js'), 'utf8');
const context = { window: {} };
vm.createContext(context);
vm.runInContext(source, context);
const api = context.window.KINOSIS_STATE_INTEGRITY;
assert.ok(api);
const merged = api.mergeTombstones(
  { a: '2026-08-19T10:00:00.000Z', b: '2026-08-18T10:00:00.000Z' },
  { a: '2026-08-18T10:00:00.000Z', b: '2026-08-20T10:00:00.000Z' },
);
assert.equal(merged.a, '2026-08-19T10:00:00.000Z');
assert.equal(merged.b, '2026-08-20T10:00:00.000Z');
assert.equal(api.changedSince(12, 13), true);
assert.equal(api.changedSince(12, 12), false);
console.log('state-integrity.test: latest tombstones and in-flight mutation generation OK');
