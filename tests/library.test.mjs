import assert from 'node:assert/strict';
import { filterLibrary, renderWatchlistOverview, renderCollectionsDirectory, renderCollectionDetailSurface } from '../assets/js/features/library.js';
import { renderMovieCard } from '../assets/js/ui/movie-card.js';

const movies = [
  { id: '1', title: 'A', year: 2000, genres: ['Drama'] },
  { id: '2', title: 'B', year: 2001, genres: ['Action'] },
  { id: '3', title: 'C', year: 2002, genres: ['Drama'] },
];
const relations = {
  '1': { rating: 4.5, favorite: true, watchlist: false },
  '2': { rating: null, favorite: false, watchlist: true },
  '3': { rating: 3.0, favorite: false, watchlist: false },
};
const logs = { '1': [{ watchedAt: '2026-08-10' }], '2': [], '3': [{ watchedAt: '2026-08-12' }, { watchedAt: '2025-01-01' }] };
const membership = { '1': { savedAt: '2026-08-01' }, '2': { savedAt: '2026-08-03' }, '3': { savedAt: '2026-08-02' } };
const c = {
  normalizeText: (value) => String(value || '').toLowerCase(),
  genreNames: (record) => record.genres || [],
  relationship: (id) => relations[id] || null,
  logsForMovie: (id) => logs[id] || [],
  availableOnMine: (record) => record.id === '2',
  isInTheatres: () => false,
  membership: (id) => membership[id] || null,
};
const base = { q: '', sort: 'recent', relationship: 'all', status: 'all', minRating: 'all', genre: 'all', availability: 'all' };
assert.deepEqual(filterLibrary(movies, { ...base, relationship: 'favorite' }, c).map((m) => m.id), ['1']);
assert.deepEqual(new Set(filterLibrary(movies, { ...base, relationship: 'rated' }, c).map((m) => m.id)), new Set(['1', '3']));
assert.deepEqual(new Set(filterLibrary(movies, { ...base, status: 'watched' }, c).map((m) => m.id)), new Set(['1', '3']));
assert.deepEqual(filterLibrary(movies, { ...base, availability: 'mine' }, c).map((m) => m.id), ['2']);

const cardContext = {
  relationship: (id) => relations[id], signedIn: () => true,
  poster: () => '', escapeHtml: (v) => String(v ?? ''), availabilityBadges: () => '', availableOnMine: () => false,
  logsForMovie: (id) => logs[id] || [], collectionsForMovie: () => [{ name: 'Favorites' }], accessLabel: () => 'WATCHA에서 감상 가능',
  formatDate: (v) => v,
};
const libraryCard = renderMovieCard(movies[0], 'library', cardContext);
assert.ok(libraryCard.includes('★ 4.5') && libraryCard.includes('1회 감상'), 'Library card must expose personal relationship context');
assert.ok(libraryCard.includes('WATCHA에서 감상 가능') && libraryCard.includes('Favorites'), 'Library card must expose access and collection context');
const discoverCard = renderMovieCard(movies[0], 'discover', cardContext);
assert.ok(!discoverCard.includes('Favorites'), 'Discover card must not inherit Library organization context');
const watchlistCard = renderMovieCard(movies[1], 'watchlist', cardContext);
assert.ok(watchlistCard.includes('보고싶어요에서 제거'), 'Watchlist card must expose an explicit removal affordance');


const overviewContext = {
  relationship: (id) => ({ ...relations[id], watchlistedAt: id === '2' ? '2026-01-01T00:00:00.000Z' : '2026-08-10T00:00:00.000Z' }),
  availableOnMine: (record) => record.id === '2',
  escapeHtml: (v) => String(v ?? ''),
  card: (record) => `<article>${record.title}</article>`,
  railFrame: (inner) => `<div class="rail">${inner}</div>`,
};
const watchlistOverview = renderWatchlistOverview({ list: [{ id:'2', title:'B', runtime:95 }, { id:'4', title:'D', runtime:130 }], c: overviewContext });
assert.ok(watchlistOverview.includes('전체 보기') && watchlistOverview.includes('지금 볼 수 있음') && watchlistOverview.includes('100분 안에 볼 수 있음'), 'Watchlist overview/full-list utility contract missing');



const collectionRenderContext = {
  escapeHtml: (v) => String(v ?? ''), formatDate: (v) => v, icon: () => '<i></i>',
  collectionMosaic: () => '<div class="mosaic"></div>',
};
const collectionDirectory = renderCollectionsDirectory({ collections: [{ id:'c1', name:'밤의 영화', description:'도시와 고독', movieIds:['1','2'], updatedAt:'2026-08-28T00:00:00Z' }], c: collectionRenderContext });
assert.ok(collectionDirectory.includes('밤의 영화') && collectionDirectory.includes('2 작품') && collectionDirectory.includes('data-collection-card="c1"'), 'collection directory must expose title/count/navigation');
const collectionDetail = renderCollectionDetailSurface({ collection:{ id:'c1', name:'밤의 영화', description:'도시와 고독', updatedAt:'2026-08-28T00:00:00Z' }, movies:[movies[0],movies[1]], posterGridHtml:'<div>grid</div>', orderEditorHtml:'<div>order</div>', c:collectionRenderContext });
assert.ok(!collectionDetail.includes('data-collection-search-input') && collectionDetail.includes('작품들') && collectionDetail.includes('도시와 고독'), 'collection detail must remain a works-first reading surface');
assert.ok(collectionDetail.includes('data-edit-collection="c1"'), 'Collection movie search/add must be reached through Edit rather than competing with the works grid');

console.log('library.test: relationship filters + watchlist utility + works-first collection display + contextual Movie Card contracts OK');
