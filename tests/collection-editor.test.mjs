import assert from 'node:assert/strict';
import { addMovieToCollection, removeMovieFromCollection, moveMovieInCollection } from '../assets/js/features/collection-editor.js';

const now = () => '2026-08-28T01:00:00.000Z';
const collection = { id: 'c1', movieIds: ['1', '2'], coverMovieId: '1', updatedAt: '' };
assert.equal(addMovieToCollection(collection, '3', now), true);
assert.deepEqual(collection.movieIds, ['1', '2', '3']);
assert.equal(addMovieToCollection(collection, 3, now), false, 'duplicate ids must not be added');
assert.equal(moveMovieInCollection(collection, 2, 'up', now), true);
assert.deepEqual(collection.movieIds, ['1', '3', '2']);
assert.equal(removeMovieFromCollection(collection, '1', now), true);
assert.deepEqual(collection.movieIds, ['3', '2']);
assert.equal(collection.coverMovieId, '3', 'cover follows first remaining movie');
assert.equal(removeMovieFromCollection(collection, '404', now), false);
console.log('collection-editor.test: add/remove/reorder collection mutations OK');
