import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sandbox = { window: {} };
vm.createContext(sandbox);
for (const rel of ['data/providers.js', 'assets/js/providers.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, rel), 'utf8'), sandbox);
}
const api = sandbox.window.KINOSIS_PROVIDERS;
assert.equal(api.canonicalKey('Watcha'), 'WATCHA');
assert.equal(api.label('Watcha'), 'WATCHA');
const watcha = api.logo({ name: 'Watcha', logoUrl: 'https://image.tmdb.org/t/p/w92/wrong.jpg' });
assert.equal(watcha.url, './assets/branding/providers/watcha-logo-white.png');
assert.equal(watcha.kind, 'wordmark');
assert.match(watcha.source, /official/i);
assert.equal(api.canonicalKey('Netflix Standard with Ads'), 'Netflix');
assert.equal(api.canonicalKey('Disney Plus'), 'Disney+');
assert.equal(api.canonicalKey('wavve'), 'Wavve');
assert.equal(api.canonicalKey('Apple TV Plus'), 'Apple TV Plus');
assert.notEqual(api.canonicalKey('Apple TV'), 'Apple TV Plus', 'Apple TV store must not be conflated with Apple TV+');
const merged = api.consolidate([
  { id: 8, name: 'Netflix', type: 'subscription', logoUrl: '/netflix.png' },
  { id: 1796, name: 'Netflix Standard with Ads', type: 'ads', logoUrl: '/netflix-ads.png' },
  { id: 97, name: 'Watcha', type: 'subscription', logoUrl: '/tmdb-watcha.png' },
]);
assert.equal(merged.length, 2, 'brand variants should consolidate');
const netflix = merged.find((row) => row.key === 'Netflix');
assert.deepEqual(Array.from(netflix.types), ['subscription', 'ads']);
const mergedWatcha = merged.find((row) => row.key === 'WATCHA');
assert.equal(mergedWatcha.logoResolved, './assets/branding/providers/watcha-logo-white.png');


const catalog = JSON.parse(fs.readFileSync(path.join(root, 'data/catalog.json'), 'utf8'));
for (const movie of catalog.movies || []) {
  const normalized = api.consolidate(movie.providers || []);
  const keys = normalized.map((row) => api.normalize(row.key || row.name));
  assert.equal(keys.length, new Set(keys).size, `duplicate canonical provider remained for ${movie.title}`);
  for (const row of normalized) {
    const mark = api.logo(row);
    assert.ok(mark.url || api.label(row), `provider has neither logo nor text fallback: ${row.name}`);
  }
}

const logoPath = path.join(root, 'assets/branding/providers/watcha-logo-white.png');
const header = fs.readFileSync(logoPath).subarray(0, 8).toString('hex');
assert.equal(header, '89504e470d0a1a0a', 'WATCHA logo override must be a PNG asset');

console.log('providers.test: canonical OTT matching, duplicate consolidation and WATCHA official override OK');
