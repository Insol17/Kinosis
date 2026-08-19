import assert from 'node:assert/strict';
import { buildArthousePool, selectArthouseRails } from '../assets/js/features/arthouse.js';

const parasite = { id: '1', title: '기생충', year: 2019, voteAverage: 8.5, voteCount: 10000 };
const spirited = { id: '2', title: '센과 치히로', year: 2001, voteAverage: 8.5, voteCount: 9000 };
const closeup = { id: '3', title: '클로즈업', year: 1990, voteAverage: 8.2, voteCount: 500 };
const recent = { id: '4', title: 'Recent Art', releaseDate: '2026-08-01', voteAverage: 7.5, voteCount: 100 };
const older = { id: '5', title: 'Older Art', releaseDate: '2020-01-01', voteAverage: 9.0, voteCount: 300 };
const classify = (record) => ({ isArt: ['4', '5'].includes(String(record.id)), score: ['4', '5'].includes(String(record.id)) ? 60 : 0 });

const pool = buildArthousePool({ curated: [closeup], staticArt: [recent], catalog: [parasite, spirited, older], classify });
assert.deepEqual(new Set(pool.map((row) => row.id)), new Set(['3', '4', '5']), 'programmed film + qualified art candidates only');
assert.ok(!pool.some((row) => row.id === '1' || row.id === '2'), 'mainstream titles must not leak into Arthouse without an explicit programme');

const rails = selectArthouseRails({ pool, programmedIds: new Set(['3']), latestLimit: 1, ratedLimit: 2 });
assert.equal(rails.latest[0].id, '4');
assert.ok(!rails.rated.some((row) => ['3', '4'].includes(row.id)), 'programmed/latest films must not repeat in the rated rail');
assert.equal(rails.rated[0].id, '5');

console.log('arthouse-feature.test: explicit programme pool + cross-rail de-duplication OK');
