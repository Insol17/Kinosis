import assert from 'node:assert/strict';

globalThis.window = {};
await import('../assets/js/core/movie-entities.js');
await import('../assets/js/features/detail.js');
await import('../assets/js/services/movie-loader.js');


const entityState = {
  library: { '15': {} },
  logs: [{ movieId: '16' }],
  collections: [{ movieIds: ['17'], coverMovieId: '18' }],
};
assert.deepEqual(new Set(window.KINOSIS_MOVIE_ENTITIES.personalIds(entityState)), new Set(['15', '16', '17', '18']));
assert.equal(window.KINOSIS_MOVIE_ENTITIES.placeholder('99').metadataLoading, true, 'missing personal entities must render a loading placeholder instead of disappearing');
const snapshot = window.KINOSIS_MOVIE_ENTITIES.compactSnapshot({ id: 15, title: '시민 케인', posterUrl: '/p.jpg', providers: [{ name: 'Netflix' }], watchLink: 'x' });
assert.equal(snapshot.title, '시민 케인');
assert.ok(!('providers' in snapshot) && !('watchLink' in snapshot), 'volatile availability must not be synced as personal metadata');

const record = {
  id: '15', title: '시민 케인', originalTitle: 'Citizen Kane', year: 1941,
  director: 'Orson Welles', directorId: '2', overview: 'overview', runtime: 119,
  genres: [{ name: '드라마' }], cast: [], providers: [],
};
const context = {
  entry: null, logs: [], related: [], country: '미국', genres: ['드라마'], releaseLabel: '', titleMeta: '1941 · 드라마',
  cast: [], writers: [], cinematographers: [], backLabel: 'DISCOVER', isArt: false,
  isSignedIn: false,
  escapeHtml: (value) => String(value ?? ''), icon: () => '', backdrop: () => '', poster: () => '', fmtRuntime: () => '1h 59m', formatDate: (value) => value,
  watchAvailabilityHtml: () => '<section>watch</section>', viewingHistoryHtml: () => '', uniqueMovies: (rows) => rows, card: () => '',
};

assert.doesNotThrow(() => window.KINOSIS_DETAIL.render(record, context), 'Detail renderer must accept boolean isSignedIn dependency');
assert.ok(window.KINOSIS_DETAIL.render(record, context).includes('로그인하고 감상 기록 남기기'));
assert.ok(window.KINOSIS_DETAIL.render(record, { ...context, isSignedIn: () => true }).includes('아직 이 영화에 대한 기록이 없습니다.'));

const entities = new Map();
const calls = [];
const rememberMovie = (row) => { const merged = { ...(entities.get(String(row.id)) || {}), ...row, id: String(row.id) }; entities.set(merged.id, merged); return merged; };
const loader = window.KINOSIS_MOVIE_LOADER.create({
  getMovie: (id) => entities.get(String(id)) || null,
  rememberMovie,
  persistLocalCache: () => {},
  apiJson: async (path) => {
    calls.push(path);
    await new Promise((resolve) => setTimeout(resolve, 5));
    if (path.startsWith('/api/movie-detail')) return { id: '15', title: '시민 케인' };
    if (path.startsWith('/api/movie-availability')) return { id: '15', providers: [], availabilityUpdatedAt: new Date().toISOString() };
    if (path.startsWith('/api/movie-summaries')) return { results: [{ id: '16', title: '요약 영화' }] };
    throw new Error(`unexpected ${path}`);
  },
});

await Promise.all([loader.loadDetail('15'), loader.loadDetail('15')]);
assert.equal(calls.filter((path) => path.startsWith('/api/movie-detail')).length, 1, 'duplicate detail requests must share one in-flight promise');
await Promise.all([loader.loadAvailability('15'), loader.loadAvailability('15')]);
assert.equal(calls.filter((path) => path.startsWith('/api/movie-availability')).length, 1, 'duplicate availability requests must share one in-flight promise');
await loader.loadSummaries(['16']);
assert.equal(entities.get('16')?.title, '요약 영화');

console.log('runtime-contracts.test: personal entity persistence + detail render contract + movie loader in-flight dedupe OK');
