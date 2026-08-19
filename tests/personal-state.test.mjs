import assert from 'node:assert/strict';
import { migratePersonalShape, ensureMembership, ensureRelationship, hasRelationshipContent, PERSONAL_SCHEMA_VERSION } from '../assets/js/domain/personal-state.js';
import { setRelationship, addLibraryMembership, removeLibraryMembership, deletePersonalFilmData } from '../assets/js/domain/personal-actions.js';

assert.equal(PERSONAL_SCHEMA_VERSION, 7);
const legacy = {
  library: {
    '10': { savedAt: '2026-01-01T00:00:00.000Z', rating: 4.5, review: '현재 한줄평', watchlist: true, favorite: true },
  },
  logs: [
    { id: 'a', movieId: '10', watchedAt: '2025-01-01', rating: 4, review: '첫 감상' },
    { id: 'b', movieId: '10', watchedAt: '2026-01-01', rating: 4.5, review: '현재 한줄평' },
  ],
};
const migrated = migratePersonalShape(legacy, { today: '2026-08-19' });
assert.deepEqual(Object.keys(migrated.library['10']).sort(), ['savedAt','updatedAt']);
assert.equal(migrated.relationships['10'].rating, 4.5);
assert.equal(migrated.relationships['10'].comment, '현재 한줄평');
assert.equal(migrated.relationships['10'].watchlist, true);
assert.equal(migrated.logs[0].ratingSnapshot, 4);
assert.equal(migrated.logs[0].note, '첫 감상');
assert.equal(migrated.logs[0].rewatch, false);
assert.equal(migrated.logs[1].rewatch, true);

const state = { library: {}, relationships: {}, meta: { deletedLibrary: {}, deletedRelationships: {} }, logs: [] };
ensureMembership(state, '30', '2026-08-19T00:00:00.000Z');
const relation = ensureRelationship(state, '30', '2026-08-19T00:01:00.000Z');
relation.rating = 5; relation.comment = '좋다';
state.logs.push({ id: 'v1', movieId: '30', watchedAt: '2026-08-19' });
delete state.library['30'];
assert.equal(state.relationships['30'].rating, 5, 'Library removal must not delete FilmRelationship');
assert.equal(state.logs.length, 1, 'Library removal must not delete ViewingEvent');
assert.equal(hasRelationshipContent(state.relationships['30']), true);

console.log('personal-state.test: v7 migration + membership/relationship/viewing separation OK');


const commandState = {
  library: {}, relationships: {}, logs: [], collections: [{ id: 'c', movieIds: ['42','99'], coverMovieId: '42' }],
  meta: { deletedLibrary: {}, deletedRelationships: {}, deletedLogs: {} },
};
addLibraryMembership(commandState, '42', '2026-08-19T01:00:00.000Z');
setRelationship(commandState, '42', { rating: 4.5, comment: '현재 한줄평', watchlist: true }, '2026-08-19T01:01:00.000Z');
commandState.logs.push({ id: 'watch-1', movieId: '42', watchedAt: '2026-08-19' });
assert.equal(removeLibraryMembership(commandState, '42', '2026-08-19T01:02:00.000Z'), true);
assert.equal(commandState.library['42'], undefined);
assert.equal(commandState.relationships['42'].comment, '현재 한줄평');
assert.equal(commandState.logs.length, 1);
addLibraryMembership(commandState, '42', '2026-08-19T01:03:00.000Z');
deletePersonalFilmData(commandState, '42', '2026-08-19T01:04:00.000Z');
assert.equal(commandState.library['42'], undefined);
assert.equal(commandState.relationships['42'], undefined);
assert.equal(commandState.logs.length, 0);
assert.deepEqual(commandState.collections[0].movieIds, ['99']);
assert.equal(commandState.meta.deletedLogs['watch-1'], '2026-08-19T01:04:00.000Z');
