import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const required = [
  'index.html','assets/css/app.css','assets/js/app.js','assets/js/core/store.js','assets/js/core/router.js','assets/js/core/movie-entities.js','assets/js/core/performance.js',
  'assets/js/domain/personal-state.js','assets/js/domain/personal-actions.js','assets/js/domain/demo-state.js','assets/js/infrastructure/api-client.js','assets/js/infrastructure/movie-repository.js','assets/js/services/movie-loader.js',
  'assets/js/features/search.js','assets/js/features/detail.js','assets/js/features/library.js','assets/js/features/arthouse.js','assets/js/features/discovery.js','assets/js/ui/movie-card.js','assets/js/cloud.js','assets/js/ui.js','assets/js/state-integrity.js','assets/js/curations.js','assets/js/curation-loader.js',
  'data/catalog.js','data/curations.js','data/curations.json','data/providers.js','data/arthouse.js','content/curations/kiarostami-life-continues.curation.json',
  'scripts/build-curations.mjs','tests/browser-smoke.mjs','netlify/functions/movie-detail.mjs','netlify/functions/movie-availability.mjs','netlify/functions/movie-summaries.mjs','netlify/functions/share.mjs','netlify/functions/director-filmography.mjs',
];
for (const rel of required) assert.ok(fs.existsSync(path.join(root, rel)), `missing ${rel}`);
for (const rel of ['sw.js','manifest.webmanifest','assets/css/design-0442.css','assets/css/styles.css']) assert.ok(!fs.existsSync(path.join(root, rel)), `${rel} should not ship`);

const html = read('index.html');
const app = read('assets/js/app.js');
const detail = read('assets/js/features/detail.js');
const search = read('assets/js/features/search.js');
const library = read('assets/js/features/library.js');
const movieCard = read('assets/js/ui/movie-card.js');
const arthouse = read('assets/js/features/arthouse.js');
const discovery = read('assets/js/features/discovery.js');
const curationLoader = read('assets/js/curation-loader.js');
const css = read('assets/css/app.css');
const detailFn = read('netlify/functions/movie-detail.mjs');
const availabilityFn = read('netlify/functions/movie-availability.mjs');
const directorFn = read('netlify/functions/director-filmography.mjs');
const curations = JSON.parse(read('data/curations.json'));

for (const marker of ['DISCOVER','ARTHOUSE','LIBRARY','PROFILE','개요','기록','통계','설정']) assert.ok(html.includes(marker), `index missing ${marker}`);
assert.ok(html.includes('app.js?v=0.4.5.2'), '0.4.5.2 cache-busting missing');
assert.ok(html.includes('type="module"'), 'main browser entry must be module');
assert.ok(html.includes('https://image.tmdb.org'), 'TMDB image CDN preconnect missing');
assert.ok(html.includes('logRatingHost') && html.includes('logNote') && !html.includes('id="logComment"') && !html.includes('id="logFavorite"'), 'ViewingEvent editor must not edit current relationship comment/favorite');
assert.ok(html.includes('relationshipDialog'), 'current FilmRelationship editor missing');
assert.ok(!html.includes('<select id="logRating"'), 'numeric rating dropdown must be removed');
assert.ok(html.includes('role="tablist"') && html.includes('aria-controls="myContent"'), 'Profile ARIA tabs missing');
assert.ok(html.includes('id="accountMenu"') && html.includes('data-account-nav="profile"') && html.includes('data-account-nav="settings"'), 'avatar account popover missing');
assert.ok(html.includes('id="enterDemoButton"') && html.includes('KINOSIS 둘러보기'), 'session-only portfolio demo entry missing');

assert.ok(app.includes('sourceSchemaVersion < PERSONAL_SCHEMA_VERSION'), 'v8 auto-shelf migration must not resurrect deliberately removed memberships on every normalize');
assert.ok(app.includes('ensureShelfForEngagement'), 'engagement-to-shelf promotion missing');
assert.ok(app.includes('removeMovieFromLibrary') && app.includes('deletePersonalMovieData'), 'Library remove and destructive delete must be separate commands');
assert.ok(app.includes('개인 기록은 보존됩니다'), 'Library removal semantics must be visible to users');
assert.ok(app.includes('reviewArchiveHtml') && app.includes('ratingArchiveHtml'), 'Profile comment/rating archive drill-down missing');
assert.ok(app.includes('selectProgrammeHeroes') && !app.includes('최근 공개된 작가영화') && !app.includes('다시 볼 만한 작품'), 'Arthouse must be programme-driven without generic pseudo-personal rails');
assert.ok(app.includes('ensureCurationPreview') && app.includes('data-curation-retry') && app.includes('curation-inline-status'), 'curation snapshot/live retry path missing');
assert.ok(app.includes('PERFORMANCE.mark') && app.includes('__KINOSIS_PERF__'), 'Detail performance diagnostics missing');
assert.ok(!app.includes("cache: 'no-store'"), 'client API must not defeat caching');
assert.ok(!app.match(/\b(prompt|confirm|alert)\s*\(/), 'native blocking dialogs must not be used');
assert.ok(app.includes("demoMode = false") && app.includes('hasCloudAccount'), 'demo mode/cloud separation missing');
assert.ok(app.includes('pendingCollectionMovieId') && app.includes('movieIds: pendingId ? [pendingId] : []'), 'creating a collection from a movie must actually add the pending film');

assert.ok(detail.includes('data-detail-part="hero"') && detail.includes('data-detail-part="availability"') && detail.includes('data-detail-part="metadata"') && detail.includes('data-detail-part="related"'), 'Detail partial-render boundaries missing');
assert.ok(detail.includes('starRatingHtml') && detail.includes('내 한줄평'), 'star rating/comment controls missing from Detail');
assert.ok(detail.includes('영화장에 보관') && detail.includes('모든 개인 데이터 삭제'), 'manual shelf/danger movie commands must be distinct');
assert.ok(detail.includes('detail-favorite'), 'favorite must be visible as a secondary Hero action');
assert.ok(!detail.includes('<dt>감독</dt>'), 'director must not be duplicated in basic facts after Hero attribution');
for (const slop of ['이 영화는 무엇인가?', '지금 어디서 볼 수 있는가?', '나와 어떤 관계인가?']) assert.ok(!detail.includes(slop), `Detail must not expose internal design question: ${slop}`);
for (const label of ['작품 정보', '감상 가능', '내 기록']) assert.ok(detail.includes(label), `Detail catalogue label missing: ${label}`);

assert.ok(search.includes('const DEBOUNCE = 180'), 'search remote debounce should be responsive at 180ms');
assert.ok(search.includes('search-loading-results') && search.includes('loading-ring mini'), 'search loading skeleton/status missing');
assert.ok(search.includes('closeForDetail') && search.includes('restoreAfterDetail'), 'search-to-detail context restoration missing');
assert.ok(search.includes('search-result-main') && search.includes('search-result-row'), 'search option/actions must be sibling controls');
assert.ok(search.includes("event.key === 'ArrowDown'") && search.includes("event.key === 'Enter'"), 'search keyboard traversal missing');

assert.ok(html.includes('PERSONAL FILM LIBRARY') && html.includes('내 영화장'), 'Personal Film Library identity missing from Library shell');
assert.ok(html.includes('data-library="watchlist"') && !html.includes('data-library="favorites"'), 'Watchlist must have a separate Library destination while favorites remain a relationship filter');
assert.ok(library.includes('data-library-relationship') && library.includes('COLLECTIONS') && library.includes('SHELF') && library.includes('renderWatchlistShelf'), 'Library IA must separate relationship filters, collections, shelf and watchlist');
assert.ok(!library.includes("filter.relationship === 'watchlist'"), 'dead watchlist relationship filter branch must be removed');
assert.ok(movieCard.includes('보고싶어요에서 제거'), 'watchlist removal affordance must be explicit');
assert.ok(movieCard.includes("variant === 'library'") && movieCard.includes("variant === 'my'"), 'contextual Movie Card variants missing');

assert.equal(curations.version, '0.4.5.2');
const editorial = curations.items.find((item) => item.slug === 'kiarostami-life-continues');
assert.ok(editorial && editorial.kind === 'editorial', 'authored editorial curation missing');
assert.ok(editorial.introduction?.length >= 3 && editorial.chapters?.length >= 3, 'editorial curation must contain substantive structured copy');
const directorArchives = curations.items.filter((item) => item.kind === 'director-archive');
assert.ok(directorArchives.length >= 4, 'Director Archive programme breadth regressed');
assert.ok(directorArchives.every((item) => /^\d+$/.test(String(item.source?.personId || ''))), 'Director Archive must use stable personId');
assert.ok(directorArchives.every((item) => Array.isArray(item.source?.snapshot) && item.source.snapshot.length), 'Director Archive must ship a snapshot fallback');
assert.ok(curationLoader.includes("status: 'error'") && curationLoader.includes('retry: (item)') && curationLoader.includes('snapshotRows'), 'curation loading/error/snapshot state machine missing');
assert.ok(arthouse.includes('selectProgrammeHeroes') && !arthouse.includes('selectArthouseRails'), 'Arthouse feature must allocate programme heroes, not generic rails');
assert.ok(discovery.includes('weightedRating') && discovery.includes('selectDiscoverHeroMovies') && discovery.includes('streaming'), 'Discover weighted ranking/varied hero/cross-rail allocation missing');
assert.ok(directorFn.includes('director:person?.name') && directorFn.includes('directorId:person?.id?String(person.id)'), 'Director Archive entity contract must preserve director identity');

assert.ok(detailFn.includes("append_to_response: 'credits'"), 'static Detail critical path should remain one upstream TMDB detail request');
assert.ok(detailFn.includes('Netlify-CDN-Cache-Control') && detailFn.includes('durable'), 'static Detail durable CDN cache missing');
assert.ok(detailFn.includes('Server-Timing'), 'Detail server timing diagnostics missing');
assert.ok(detailFn.includes('max-age=3600'), 'browser Detail cache should avoid needless immediate revalidation');
assert.ok(availabilityFn.includes('Netlify-CDN-Cache-Control') && availabilityFn.includes('max-age=900'), 'availability must use a shorter independent cache');

assert.ok(css.includes('.star-rating') && css.includes('.detail-comment'), 'star/comment visual system missing');
assert.ok(css.includes('.curation-rail-section') && css.includes('.curation-authored-film'), 'curation rail/detail styles missing');
assert.ok(css.includes('.review-archive-list'), 'Profile review archive styles missing');
assert.ok(css.includes('.library-row-remove'), 'Library row removal affordance missing');
assert.ok((css.match(/!important/g) || []).length <= 8, 'stylesheet cleanup regressed into important overrides');
assert.ok(css.includes('content-visibility:auto'), 'render containment/performance rule missing');
assert.ok(css.includes('.hero-dot.is-active span') && !css.includes('.hero-dot.is-active{width:42px;background:var(--accent);}'), 'Hero active indicator stale orange block regression returned');
assert.ok(html.includes('This product uses the TMDB API but is not endorsed or certified by TMDB.'), 'TMDB notice missing');

assert.ok(app.includes('calendar-grid-poster') && app.includes('VIEWING CALENDAR'), 'poster-based monthly viewing calendar missing');
assert.ok(app.includes('data-rail-step="prev"') && app.includes('data-rail-step="next"'), 'film rail previous/next controls missing');
assert.ok(css.includes('.provider-badge-skeleton'), 'stable provider loading slot missing');
assert.ok(app.includes('allWatchlistMovies') && library.includes('보고싶어요'), 'watchlist-only Library surface missing');
console.log('static.test: 0.4.5.2 coherence + programme Arthouse + demo/search/library contracts OK');
