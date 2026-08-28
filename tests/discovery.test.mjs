import assert from 'node:assert/strict';
import { allocateSections, selectDiscoverHeroMovies, weightedRating } from '../assets/js/features/discovery.js';
import { renderDiscoverCurationCarousel, selectDiscoverCurations } from '../assets/js/features/discover-curation-carousel.js';
import { DISCOVER_GENRES } from '../assets/js/features/discover-directory.js';

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


assert.equal(DISCOVER_GENRES.length, 18, 'Genre directory should expose the expanded 18-genre catalogue');
for (const genre of ['공포','코미디','SF','드라마','애니메이션','다큐멘터리','가족','역사','음악','미스터리','전쟁','서부']) {
  assert.ok(DISCOVER_GENRES.some(([key]) => key === genre), `Genre directory missing ${genre}`);
}

const curationItems = [
  { slug: 'other', title: 'Other', kind: 'editorial' },
  { slug: 'family-in-the-end', title: '결국 가족이다', kind: 'editorial' },
  { slug: 'lonely-wandering', title: '고독한 방황', kind: 'editorial' },
  { slug: 'nouvelle-vague-masterpieces', title: '누벨바그 걸작선', kind: 'editorial' },
  { slug: 'director', title: 'Director', kind: 'director-archive' },
];
const spotlight = selectDiscoverCurations(curationItems, ['family-in-the-end','lonely-wandering','nouvelle-vague-masterpieces'], 3);
assert.deepEqual(spotlight.map((item) => item.slug), ['family-in-the-end','lonely-wandering','nouvelle-vague-masterpieces'], 'Discover curation spotlight must prioritize the three authored doorway programmes');
const spotlightHtml = renderDiscoverCurationCarousel({ items: spotlight, imageFor: () => '/hero.jpg', escapeHtml: (value) => String(value ?? '') });
assert.equal((spotlightHtml.match(/data-discover-curation-slide=/g) || []).length, 3, 'Discover curation spotlight must render three carousel slides');
assert.ok(spotlightHtml.includes('data-discover-curation-dir="-1"') && spotlightHtml.includes('data-discover-curation-dir="1"'), 'Discover curation spotlight must expose explicit previous/next controls');
assert.ok(spotlightHtml.includes('>←</button>') && spotlightHtml.includes('>→</button>'), 'Discover spotlight navigation should use clear directional arrows rather than faint chevrons');
assert.ok(!spotlightHtml.includes('FILMS'), 'Discover curation spotlight must not expose noisy film-count metadata');

console.log('discovery.test: varied hero + cross-rail allocation + weighted ranking + curation spotlight OK');
