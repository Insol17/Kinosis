import assert from 'node:assert/strict';
import { allocateSections, selectDiscoverHeroMovies, weightedRating } from '../assets/js/features/discovery.js';

const movie = (id, voteAverage = 0, voteCount = 0) => ({ id: String(id), title: `Film ${id}`, voteAverage, voteCount });

const hero = selectDiscoverHeroMovies({
  featured: [movie(1), movie(2)],
  boxOffice: [movie(1), movie(3)],
  upcoming: [movie(3), movie(4)],
  rated: [movie(4, 8.4, 12000), movie(5, 8.1, 22000)],
}, 4);
assert.deepEqual(hero.map((row) => row.id), ['1', '3', '4', '5'], 'Discover Hero should rotate through sources without repeating the same film');

const allocated = allocateSections({
  heroMovieIds: ['1'],
  boxOffice: [movie(1), movie(2), movie(3)],
  upcoming: [movie(2), movie(4), movie(5)],
  streaming: [movie(3), movie(4), movie(6)],
  rated: [movie(5, 8.2, 5000), movie(6, 8.3, 6000), movie(7, 8.4, 7000)],
}, { boxOffice: 2, upcoming: 2, streaming: 2, rated: 2 });
assert.deepEqual(allocated.boxOffice.map((row) => row.id), ['1','2'], 'KOBIS ranking must preserve rank #1 even when it also appears in Hero');
const recommendationIds = [...allocated.upcoming, ...allocated.streaming, ...allocated.rated].map((row) => row.id);
assert.equal(new Set(recommendationIds).size, recommendationIds.length, 'non-factual Discover rails should avoid repeating one another');

const trusted = weightedRating(movie(10, 8.5, 10000), { mean: 7, confidence: 1500 });
const tinySample = weightedRating(movie(11, 9.0, 50), { mean: 7, confidence: 1500 });
assert.ok(trusted > tinySample, 'weighted rating should prefer a strongly supported high score over a tiny-sample raw average');

console.log('discovery.test: varied hero + cross-rail allocation + weighted ranking OK');
