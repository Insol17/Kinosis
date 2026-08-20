import assert from 'node:assert/strict';
import * as entitiesApi from '../assets/js/core/movie-entities.js';
import { renderDetail } from '../assets/js/features/detail.js';
import { createMovieLoader } from '../assets/js/services/movie-loader.js';

const entityState = {
  library: { '15': {} },
  relationships: { '19': { rating: 4.5 } },
  logs: [{ movieId: '16' }],
  collections: [{ movieIds: ['17'], coverMovieId: '18' }],
};
assert.deepEqual(new Set(entitiesApi.personalIds(entityState)), new Set(['15', '16', '17', '18', '19']));
assert.equal(entitiesApi.placeholder('99').metadataLoading, true, 'missing personal entities must render an explicit loading placeholder');
const snapshot = entitiesApi.compactSnapshot({ id: 15, title: '시민 케인', director: 'Orson Welles', directorId: '2', posterUrl: '/p.jpg', backdropUrl: '/b.jpg', providers: [{ name: 'Netflix' }], watchLink: 'x' });
assert.equal(snapshot.title, '시민 케인');
assert.equal(snapshot.backdropUrl, '/b.jpg');
assert.equal(snapshot.directorId, '2');
assert.ok(!('providers' in snapshot) && !('watchLink' in snapshot), 'volatile availability must not be synced as personal metadata');

const record = {
  id: '15', title: '시민 케인', originalTitle: 'Citizen Kane', year: 1941,
  director: 'Orson Welles', directorId: '2', overview: 'overview', runtime: 119,
  genres: [{ name: '드라마' }], cast: [], providers: [],
};
const context = {
  relationship: null, membership: null, entry: null, logs: [], related: [], country: '미국', genres: ['드라마'], releaseLabel: '', titleMeta: '1941 · 드라마',
  cast: [], writers: [], cinematographers: [], backLabel: 'DISCOVER', isArt: false,
  isSignedIn: false,
  escapeHtml: (value) => String(value ?? ''), icon: () => '', backdrop: () => '', poster: () => '', fmtRuntime: () => '1h 59m', formatDate: (value) => value,
  watchAvailabilityHtml: () => '<section>watch</section>', viewingHistoryHtml: () => '', uniqueMovies: (rows) => rows, card: () => '', starRatingHtml: () => '<div>stars</div>',
};
assert.doesNotThrow(() => renderDetail(record, context), 'Detail renderer must accept boolean isSignedIn dependency');
assert.ok(renderDetail(record, context).includes('로그인하고 내 영화로 기록하기'));
assert.ok(renderDetail(record, { ...context, isSignedIn: () => true }).includes('아직 감상 기록이 없습니다.'));
for (const slop of ['이 영화는 무엇인가?', '지금 어디서 볼 수 있는가?', '나와 어떤 관계인가?']) assert.ok(!renderDetail(record, context).includes(slop));
for (const label of ['작품 정보', '감상처', '내 기록']) assert.ok(renderDetail(record, context).includes(label));
const preserved = entitiesApi.merge({ id: '31', title: '기존', director: '감독 A', directorId: '99', runtime: 123, providers: [{ name: 'WATCHA' }], cast: [{ name: 'A' }] }, { id: '31', title: '새 제목' });
assert.equal(preserved.providers?.[0]?.name, 'WATCHA', 'lightweight entity merge must preserve provider availability');
assert.equal(preserved.cast?.[0]?.name, 'A', 'lightweight entity merge must preserve enriched cast');
assert.equal(preserved.director, '감독 A', 'lightweight entity merge must preserve director metadata');
assert.equal(preserved.directorId, '99');
assert.equal(preserved.runtime, 123);

const store = new Map();
const calls = [];
const rememberMovie = (row) => { const merged = { ...(store.get(String(row.id)) || {}), ...row, id: String(row.id) }; store.set(merged.id, merged); return merged; };
const repository = {
  detail: async (id) => { calls.push(`detail:${id}`); await new Promise((resolve) => setTimeout(resolve, 5)); return { id, title: '시민 케인' }; },
  availability: async (id) => { calls.push(`availability:${id}`); await new Promise((resolve) => setTimeout(resolve, 5)); return { id, providers: [], availabilityUpdatedAt: new Date().toISOString() }; },
  summaries: async (ids) => { calls.push(`summaries:${ids.join(',')}`); return { results: ids.map((id) => ({ id, title: `요약 ${id}` })) }; },
  prefetchDetail: async (id) => { calls.push(`prefetch:${id}`); return null; },
};
const loader = createMovieLoader({ repository, getMovie: (id) => store.get(String(id)) || null, rememberMovie, persistLocalCache: () => {} });
await Promise.all([loader.loadDetail('15'), loader.loadDetail('15')]);
assert.equal(calls.filter((row) => row === 'detail:15').length, 1, 'duplicate detail requests must share one in-flight promise');
await Promise.all([loader.loadAvailability('15'), loader.loadAvailability('15')]);
assert.equal(calls.filter((row) => row === 'availability:15').length, 1, 'duplicate availability requests must share one in-flight promise');
await loader.loadSummaries(['16']);
assert.equal(store.get('16')?.title, '요약 16');

// Race regression: availability resolving after detail must merge against the
// freshest entity rather than restoring an older placeholder snapshot.
store.set('22', { id: '22', title: 'placeholder', metadataLoading: true });
let detailResolve, availabilityResolve;
const raceRepository = {
  detail: () => new Promise((resolve) => { detailResolve = resolve; }),
  availability: () => new Promise((resolve) => { availabilityResolve = resolve; }),
  summaries: async () => ({ results: [] }), prefetchDetail: async () => null,
};
const raceLoader = createMovieLoader({ repository: raceRepository, getMovie: (id) => store.get(String(id)), rememberMovie, persistLocalCache: () => {} });
const dp = raceLoader.loadDetail('22');
const ap = raceLoader.loadAvailability('22');
detailResolve({ id: '22', title: '실제 제목', director: '감독' });
await dp;
availabilityResolve({ id: '22', providers: [{ name: 'WATCHA' }], availabilityUpdatedAt: new Date().toISOString() });
await ap;
assert.equal(store.get('22').title, '실제 제목', 'availability merge must not revert fresh detail metadata');
assert.equal(store.get('22').metadataLoading, false);

console.log('runtime-contracts.test: entity + detail + loader dedupe/race contracts OK');
