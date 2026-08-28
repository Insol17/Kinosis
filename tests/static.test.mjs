import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const required = [
  'index.html','assets/css/app.css','assets/js/app.js','assets/js/core/store.js','assets/js/core/router.js','assets/js/core/movie-entities.js','assets/js/core/performance.js','assets/js/core/request-scheduler.js',
  'assets/js/domain/personal-state.js','assets/js/domain/personal-actions.js','assets/js/domain/demo-state.js','assets/js/domain/auth-role.js','assets/js/infrastructure/api-client.js','assets/js/infrastructure/movie-repository.js','assets/js/services/movie-loader.js',
  'assets/js/features/search.js','assets/js/features/collection-search.js','assets/js/features/collection-editor.js','assets/js/features/detail.js','assets/js/features/library.js','assets/js/features/arthouse.js','assets/js/features/arthouse-directory.js','assets/js/features/director-profile-controller.js','assets/js/features/discovery.js','assets/js/features/discover-curation-carousel.js','assets/js/features/discover-directory.js','assets/js/features/profile-avatar.js','assets/js/features/studio.js','assets/js/features/calendar.js','assets/js/ui/movie-card.js','assets/js/cloud.js','assets/js/ui.js','assets/js/state-integrity.js','assets/js/curations.js',
  'data/catalog.js','data/curations.js','data/directors.js','data/curations.json','data/providers.js','data/arthouse.js','data/collectio-kr.mjs','data/collectio-kr.json','data/theatrical-kr.js','data/theatrical-kr.json','data/theatrical-kr.mjs','data/kobis-tmdb-map.json','content/curations/kiarostami-life-continues.curation.json',
  'scripts/build-curations.mjs','scripts/update-theatrical.mjs','scripts/update-collectio.mjs','scripts/hydrate-director-snapshots.mjs','.github/workflows/refresh-collectio.yml','tests/browser-smoke.mjs','supabase/005_kinosis_0453.sql','supabase/006_kinosis_0454.sql','netlify/functions/movie-detail.mjs','netlify/functions/movie-availability.mjs','netlify/functions/movie-summaries.mjs','netlify/functions/share.mjs','netlify/functions/director-filmography.mjs','netlify/functions/director-profiles.mjs',
];
for (const rel of required) assert.ok(fs.existsSync(path.join(root, rel)), `missing ${rel}`);
for (const rel of ['sw.js','manifest.webmanifest','assets/css/design-0442.css','assets/css/styles.css']) assert.ok(!fs.existsSync(path.join(root, rel)), `${rel} should not ship`);

const html = read('index.html');
const app = read('assets/js/app.js');
const detail = read('assets/js/features/detail.js');
const search = read('assets/js/features/search.js');
const collectionSearch = read('assets/js/features/collection-search.js');
const collectionEditor = read('assets/js/features/collection-editor.js');
const movieSearchIndex = read('assets/js/features/movie-search-index.js');
const library = read('assets/js/features/library.js');
const movieCard = read('assets/js/ui/movie-card.js');
const arthouse = read('assets/js/features/arthouse.js');
const arthouseDirectory = read('assets/js/features/arthouse-directory.js');
const discovery = read('assets/js/features/discovery.js');
const discoverCurationCarousel = read('assets/js/features/discover-curation-carousel.js');
const css = read('assets/css/app.css');
const detailFn = read('netlify/functions/movie-detail.mjs');
const availabilityFn = read('netlify/functions/movie-availability.mjs');
const directorFn = read('netlify/functions/director-filmography.mjs');
const curations = JSON.parse(read('data/curations.json'));

for (const marker of ['DISCOVER','ARTHOUSE','LIBRARY','PROFILE','개요','기록','통계','설정']) assert.ok(html.includes(marker), `index missing ${marker}`);
assert.ok(html.includes('app.js?v=0.4.6.6'), '0.4.6.6 cache-busting missing');
assert.ok(html.includes('type="module"'), 'main browser entry must be module');
assert.ok(html.includes('https://image.tmdb.org'), 'TMDB image CDN preconnect missing');
const netlifyConfig = read('netlify.toml');
for (const host of ['www.netflix.com','www.coupangplay.com','www.disneyplus.com','watcha.com','www.apple.com','www.primevideo.com','www.youtube.com','collectio.co.kr']) assert.ok(netlifyConfig.includes(`https://${host}`), `CSP must allow first-party provider image host ${host}`);
assert.ok(html.includes('logRatingHost') && html.includes('logNote') && !html.includes('id="logComment"') && !html.includes('id="logFavorite"'), 'ViewingEvent editor must not edit current relationship comment/favorite');
assert.ok(html.includes('relationshipDialog'), 'current FilmRelationship editor missing');
assert.ok(!html.includes('<select id="logRating"'), 'numeric rating dropdown must be removed');
assert.ok(html.includes('role="tablist"') && html.includes('aria-controls="myContent"'), 'Profile ARIA tabs missing');
assert.ok(html.includes('id="accountMenu"') && html.includes('data-account-nav="profile"') && html.includes('data-account-nav="settings"') && html.includes('data-account-nav="studio" hidden'), 'avatar account popover/admin-only Studio entry missing');
assert.ok(html.includes('id="enterDemoButton"') && html.includes('KINOSIS 둘러보기'), 'session-only portfolio demo entry missing');

assert.ok(app.includes('sourceSchemaVersion < PERSONAL_SCHEMA_VERSION'), 'v8 auto-shelf migration must not resurrect deliberately removed memberships on every normalize');
assert.ok(app.includes('ensureShelfForEngagement'), 'engagement-to-shelf promotion missing');
assert.ok(app.includes('removeMovieFromLibrary') && app.includes('deletePersonalMovieData'), 'Library remove and destructive delete must be separate commands');
assert.ok(app.includes('개인 기록은 보존됩니다'), 'Library removal semantics must be visible to users');
assert.ok(app.includes('reviewArchiveHtml') && app.includes('ratingArchiveHtml'), 'Profile comment/rating archive drill-down missing');
assert.ok(app.includes('selectProgrammeHeroes') && !app.includes('최근 공개된 작가영화') && !app.includes('다시 볼 만한 작품'), 'Arthouse must be programme-driven without generic pseudo-personal rails');
assert.ok(app.includes('seedCurationSnapshots') && app.includes('curationHeroImage') && app.includes('discoverCurationSpotlight'), 'programme snapshot/direct Hero/spotlight path missing');
assert.ok(app.includes('PERFORMANCE.mark') && app.includes('__KINOSIS_PERF__'), 'Detail performance diagnostics missing');
assert.ok(!app.includes("cache: 'no-store'"), 'client API must not defeat caching');
assert.ok(!app.match(/\b(prompt|confirm|alert)\s*\(/), 'native blocking dialogs must not be used');
assert.ok(app.includes("demoMode = false") && app.includes('hasCloudAccount'), 'demo mode/cloud separation missing');
assert.ok(app.includes('pendingCollectionMovieId') && app.includes('collectionEditorDraftMovieIds') && app.includes('pendingCollectionMovieId ? [pendingCollectionMovieId]'), 'creating/editing a collection must carry the pending film into the editor draft');

assert.ok(detail.includes('data-detail-part="hero"') && detail.includes('data-detail-part="availability"') && detail.includes('data-detail-part="metadata"') && detail.includes('data-detail-part="related"'), 'Detail partial-render boundaries missing');
assert.ok(detail.includes('starRatingHtml') && detail.includes('내 리뷰') && detail.includes('detail-personal-record'), 'integrated rating/review controls missing from Detail');
assert.ok(detail.includes('영화장에 보관') && detail.includes('모든 개인 데이터 삭제'), 'manual shelf/danger movie commands must be distinct');
assert.ok(detail.includes('detail-favorite'), 'favorite must be visible as a secondary Hero action');

assert.ok(html.includes('stillLightbox') && detail.includes('data-still-open') && !detail.includes('target="_blank" rel="noopener noreferrer"><img'), 'Detail stills must open in the in-page lightbox');
assert.ok(arthouseDirectory.includes('ARTHOUSE_PREVIEW_DIRECTOR_COUNT = 35') && arthouseDirectory.includes('renderDirectorDirectory') && html.includes('data-arthouse-section="directors"'), 'Arthouse must show a 35-director preview and route the full archive to its own section');
assert.ok(app.includes('DIRECTOR_PROFILE_CONTROLLER.observe') && !app.includes('loadDirectorProfiles'), 'Director portraits must hydrate lazily by viewport rather than fan out the whole directory at once');
assert.ok(html.includes('topnav-submenu') && html.includes('CURATION') && html.includes("DIRECTOR'S ARCHIVE"), 'desktop Arthouse hover categories missing');
assert.ok(detail.includes('originalLanguageLabel') && detail.includes('spokenLanguages'), 'Detail must render localized language labels when available');
assert.ok(app.includes('collectionMosaic') && html.includes('collectionPickerDialog'), 'Collections need mosaic covers and multi-collection picking');
assert.ok(collectionSearch.includes('data-collection-search-add') && !collectionSearch.includes('data-collection-search-remove') && collectionSearch.includes('if (!state.query) return []') && collectionSearch.includes('const DEBOUNCE = 120'), 'Collection finder must be add-only, dormant before typing, and responsive');
assert.ok(app.includes('data-collection-remove') && library.includes('data-library-search-all'), 'Collection browse removal and Library-level movie finder must remain directly reachable');
assert.ok(search.includes('data-add-library'), 'Global Search must provide a direct add-to-library action');
assert.ok(collectionEditor.includes('addMovieToCollection') && collectionEditor.includes('removeMovieFromCollection') && collectionEditor.includes('moveMovieInCollection'), 'collection mutations must be centralized in a pure editor module');
assert.ok(movieSearchIndex.includes('haystack') && movieSearchIndex.includes('scoreIndexed'), 'Movie search must pre-index normalized fields instead of rescanning normalization on every keypress');
assert.ok(library.includes('renderCollectionsDirectory') && library.includes('renderCollectionDetailSurface') && !library.includes('data-collection-search-input') && html.includes('data-collection-search-root="editor"'), 'Collection detail must stay works-first while movie search lives inside Edit');
for (const fn of ['applyCollectionPicker', 'saveProgrammeAsCollection']) {
  const start = app.indexOf(`function ${fn}`) >= 0 ? app.indexOf(`function ${fn}`) : app.indexOf(`async function ${fn}`);
  const end = app.indexOf('\n  function ', start + 1) >= 0 ? app.indexOf('\n  function ', start + 1) : app.indexOf('\n  async function ', start + 1);
  const body = app.slice(start, end > start ? end : start + 2200);
  assert.ok(start >= 0 && !body.includes('ensureShelfForEngagement'), `${fn} must not silently promote Collection films into the Library shelf`);
}

assert.ok(!detail.includes('<dt>감독</dt>'), 'director must not be duplicated in basic facts after Hero attribution');
for (const slop of ['이 영화는 무엇인가?', '지금 어디서 볼 수 있는가?', '나와 어떤 관계인가?']) assert.ok(!detail.includes(slop), `Detail must not expose internal design question: ${slop}`);
for (const label of ['작품 정보', '감상처', '내 기록']) assert.ok(detail.includes(label), `Detail catalogue label missing: ${label}`);


assert.ok(html.includes('studioMovieDialog') && html.includes('studioHeroImageDialog'), 'Studio rich movie/Hero image pickers missing');
assert.ok(detail.includes('트레일러 · 스틸') && detail.includes('youtube-nocookie.com'), 'Detail trailer/still surface missing');
assert.ok(movieCard.includes('card-personal-rating') && !movieCard.includes('availabilityBadges'), 'cards must show personal rating and omit OTT badge rendering');
assert.ok(css.includes('.film-rail-arrow[hidden]') && css.includes('.discover-curation-carousel') && css.includes('.curation-feature-row'), 'rail/spotlight/curation design contracts missing');
assert.ok(app.includes('data-save-programme-collection') && app.includes('saveProgrammeAsCollection'), 'programme-to-personal-collection action missing');
assert.ok(app.includes('discoverCurationSpotlight') && app.includes(".map((record) => ({ ...record, heroType: 'movie'"), 'Discover must expose Curation through the inline spotlight while keeping Hero movie-only');
assert.ok(app.includes('data-discover-section="streaming"') && app.includes('data-discover-section="genres"') && !app.includes('data-discover-section="boxoffice"'), 'Discover should keep OTT/genre directories without turning factual Box Office into a separate page');
assert.ok(app.includes('watch-now-provider-row') && app.includes('watch-now-poster-row') && movieCard.includes('평가함 ★'), 'Watch Now must reuse poster cards, retain provider marks, and preserve evaluated-rating labels');
assert.ok(!css.includes('.watch-now-grid') && !css.includes('.watch-now-card') && !css.includes('.collection-inline-search'), 'retired Watch Now/Collection inline-search styles must not linger');
assert.ok(!css.includes('.topnav-menu:focus-within .topnav-submenu'), 'Arthouse submenu must not be pinned by generic menu focus-within');

assert.ok(!discoverCurationCarousel.includes('FILMS'), 'curation spotlight must not display film-count metadata');
assert.ok(css.includes('.rating-histogram') && css.includes('.settings-hub'), 'Profile graph/settings hub visual contracts missing');
assert.ok(html.includes('profileAvatarSearch') && app.includes('collectProfileAvatarCandidates'), 'profile avatar metadata picker must remain available without a dedicated image API');
const collectioWorkflow = read('.github/workflows/refresh-collectio.yml');
assert.ok(collectioWorkflow.includes('schedule:') && collectioWorkflow.includes('update-collectio.mjs'), 'daily Collectio snapshot workflow missing');
assert.ok(search.includes('const DEBOUNCE = 120') && search.includes('createMovieSearchIndex'), 'search should use a precomputed local index and a short remote debounce');
assert.ok(search.includes('search-loading-results') && search.includes('loading-ring mini'), 'search loading skeleton/status missing');
assert.ok(search.includes('closeForDetail') && search.includes('restoreAfterDetail'), 'search-to-detail context restoration missing');
assert.ok(search.includes('search-result-main') && search.includes('search-result-row'), 'search option/actions must be sibling controls');
assert.ok(search.includes("event.key === 'ArrowDown'") && search.includes("event.key === 'Enter'"), 'search keyboard traversal missing');

assert.ok(html.includes('PERSONAL FILM LIBRARY') && html.includes('내 영화장'), 'Personal Film Library navigation identity missing');
assert.ok(!library.includes('library-home-head'), 'oversized Library manifesto/header must stay removed');
assert.ok(library.includes('stable-library-head'), 'shelf/watchlist need stable-height headers');
assert.ok(html.includes('data-library="watchlist"') && !html.includes('data-library="favorites"'), 'Watchlist must have a separate Library destination while favorites remain a relationship filter');
assert.ok(library.includes('data-library-relationship') && library.includes('COLLECTIONS') && library.includes('SHELF') && library.includes('renderWatchlistShelf'), 'Library IA must separate relationship filters, collections, shelf and watchlist');
assert.ok(!library.includes("filter.relationship === 'watchlist'"), 'dead watchlist relationship filter branch must be removed');
assert.ok(movieCard.includes('보고싶어요에서 제거'), 'watchlist removal affordance must be explicit');
assert.ok(movieCard.includes("variant === 'library'") && movieCard.includes("variant === 'my'"), 'contextual Movie Card variants missing');

assert.equal(curations.version, '0.4.6.6');
const editorial = curations.items.find((item) => item.slug === 'kiarostami-life-continues');
assert.ok(editorial && editorial.kind === 'editorial', 'authored editorial curation missing');
assert.equal(editorial.movies?.length, 6, 'life-continues curation must contain the six approved films');
assert.deepEqual(editorial.movies.map((row) => row.id), ['30020','38047','103663','334541','265180','976893']);
assert.ok(editorial.movies.every((row) => String(row.note || '').trim()), 'every Curation film needs a curator explanation');
assert.equal(editorial.orderMode, 'curated');
assert.ok(editorial.heroImageUrl, 'published Curation must ship a direct Hero image');
const directorArchives = curations.items.filter((item) => item.kind === 'director-archive');
assert.ok(directorArchives.length >= 4, 'Director Archive programme breadth regressed');
assert.ok(directorArchives.every((item) => Array.isArray(item.movies) && item.movies.length), 'Director Archive must be an explicit admin-selected movie list');
assert.ok(app.includes('ensureCurationMovies') && !app.includes('최근 공개된 작가영화') && !app.includes('다시 볼 만한 작품'), 'programme hydration/public Arthouse contract missing');
assert.ok(arthouse.includes('selectProgrammeHeroes') && !arthouse.includes('selectArthouseRails'), 'Arthouse feature must allocate programme heroes, not generic rails');
assert.ok(discovery.includes('weightedRating') && discovery.includes('selectDiscoverHeroMovies') && discovery.includes('streaming'), 'Discover weighted ranking/varied hero/cross-rail allocation missing');
assert.ok(directorFn.includes('director:person?.name') && directorFn.includes('directorId:person?.id?String(person.id)'), 'Director Archive entity contract must preserve director identity');

assert.ok(detailFn.includes("append_to_response: 'credits'"), 'static Detail critical path should remain one upstream TMDB detail request');
assert.ok(detailFn.includes('Netlify-CDN-Cache-Control') && detailFn.includes('durable'), 'static Detail durable CDN cache missing');
assert.ok(detailFn.includes('Server-Timing'), 'Detail server timing diagnostics missing');
assert.ok(detailFn.includes('max-age=3600'), 'browser Detail cache should avoid needless immediate revalidation');
assert.ok(availabilityFn.includes('Netlify-CDN-Cache-Control') && availabilityFn.includes('max-age=900'), 'availability must use a shorter independent cache');

assert.ok(css.includes('.star-rating') && css.includes('.detail-comment'), 'star/comment visual system missing');
assert.ok(css.includes('.arthouse-curation-banner') && css.includes('.curation-ordered-list') && css.includes('.director-archive-groups'), 'curation banner/detail styles missing');
assert.ok(css.includes('#arthouseView{position:relative;isolation:isolate') && css.includes('.arthouse-surface-texture'), 'Arthouse editorial surface layer missing');
assert.ok(!/Georgia|Times New Roman/.test(css), 'Arthouse/Curation must not split into a second font system');
assert.ok(!css.includes('.curation-chapter') && !css.includes('.curation-authored-film'), 'retired magazine/chapter Curation styles must not linger');
assert.ok(css.includes('.review-archive-list'), 'Profile review archive styles missing');
assert.ok(css.includes('.library-row-remove'), 'Library row removal affordance missing');
assert.ok((css.match(/!important/g) || []).length <= 8, 'stylesheet cleanup regressed into important overrides');
assert.ok(css.includes('content-visibility:auto'), 'render containment/performance rule missing');
assert.ok(css.includes('.hero-dot.is-active span') && !css.includes('.hero-dot.is-active{width:42px;background:var(--accent);}'), 'Hero active indicator stale orange block regression returned');
assert.ok(html.includes('This product uses the TMDB API but is not endorsed or certified by TMDB.'), 'TMDB notice missing');

assert.ok(app.includes('calendar-grid-cinematic') && app.includes('VIEWING CALENDAR') && app.includes('calendar-agenda'), 'cinematic monthly viewing calendar + mobile agenda missing');
assert.ok(app.includes('data-rail-step="prev"') && app.includes('data-rail-step="next"'), 'film rail previous/next controls missing');
assert.ok(css.includes('.provider-badge-skeleton'), 'stable provider loading slot missing');
assert.ok(app.includes('allWatchlistMovies') && library.includes('보고싶어요'), 'watchlist-only Library surface missing');
assert.ok(app.includes('refreshWatchlistAvailability(true, [id])') && app.includes('refreshWatchlistAvailability(false).catch'), 'watchlist availability must refresh the changed film instead of rescanning the whole watchlist on common events');
assert.ok(library.includes('renderWatchlistOverview') && library.includes('data-watchlist-all') && library.includes('100분 안에 볼 수 있음'), 'Watchlist utility overview/full-list contract missing');
assert.ok(app.includes('watchNowSection') && app.includes('discoverGenreSection') && app.includes('data-discover-genre'), 'Discover watch-now/genre exploration surfaces missing');
assert.ok(discoverCurationCarousel.includes('IntersectionObserver') && discoverCurationCarousel.includes('DISCOVER_CURATION_SPOTLIGHT_COUNT = 3') && discoverCurationCarousel.includes('prefers-reduced-motion'), 'Discover curation spotlight must rotate only while visible and respect reduced motion');
assert.ok(!app.includes("record.theatricalStatus === 'recent' ? '최근 극장 개봉'"), 'recent release must not masquerade as current theatrical availability');

assert.ok(html.includes('id="studioView"') && app.includes('openStudio') && app.includes('isAdmin()'), 'admin-only Studio surface missing');
const boxOfficeFn = read('netlify/functions/box-office.mjs');
const upcomingFn = read('netlify/functions/upcoming.mjs');
const theatricalIngest = read('scripts/update-theatrical.mjs');
const directorHydrate = read('scripts/hydrate-director-snapshots.mjs');
assert.ok(boxOfficeFn.includes("../../data/theatrical-kr.mjs") && !boxOfficeFn.includes('kobis.or.kr'), 'public box office must project committed theatrical snapshot without live KOBIS');
assert.ok(upcomingFn.includes("../../data/theatrical-kr.mjs") && !upcomingFn.includes('/discover/movie'), 'public upcoming must project KOBIS theatrical snapshot instead of runtime TMDB discover');
assert.ok(theatricalIngest.includes('KOBIS_API_KEY') && theatricalIngest.includes('kobis-tmdb-map.json') && theatricalIngest.includes('externalOnly: true'), 'KOBIS ingest/mapping/unmatched-row contract missing');
assert.ok(directorHydrate.includes('TMDB_READ_ACCESS_TOKEN') && directorHydrate.includes('snapshotGeneratedAt'), 'Director build snapshot hydration missing');
assert.ok(css.includes('.curation-collection-grid') && css.includes('.arthouse-curation-banner-list') && css.includes('grid-template-columns:repeat(7,minmax(0,1fr))'), 'Curation detail plus wide-banner index / seven-column director preview contracts missing');
assert.ok(!css.includes('.arthouse-section-switcher') && !app.includes('renderArthouseSectionSwitcher'), 'redundant in-page Arthouse category switcher must stay removed');
assert.ok(!css.includes('.arthouse-collection-card') && !css.includes('.curation-rail-section'), 'retired Arthouse card/rail styles must not linger');
console.log('static.test: 0.4.6.6 watchlist utility + accurate availability + visual discovery contracts OK');
