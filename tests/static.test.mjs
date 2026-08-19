import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const required = [
  'index.html','assets/css/app.css','assets/js/app.js','assets/js/cloud.js','assets/js/ui.js','assets/js/config.js','assets/js/error-boundary.js',
  'assets/js/art-classifier.js','assets/js/importers.js','assets/js/features/search.js','assets/js/features/detail.js','assets/js/state-integrity.js','assets/js/curations.js','assets/js/curation-loader.js','assets/js/hero-carousel.js','assets/js/providers.js',
  'data/catalog.js','data/curations.js','data/curations.json','data/providers.js','data/arthouse.js',
  'content/curations/README.md','scripts/build-curations.mjs','icons/icon.svg','assets/branding/tmdb-logo.svg','assets/branding/providers/watcha-logo-white.png','docs/API-SOURCES.md',
  'netlify/lib/locale.mjs','netlify/functions/share.mjs','netlify/functions/movie-search.mjs','netlify/functions/movie-detail.mjs','netlify/functions/box-office.mjs','netlify/functions/movie-recommendations.mjs','netlify/functions/person-films.mjs','netlify/functions/director-filmography.mjs','netlify/functions/watchlist-availability.mjs','netlify/functions/my-streaming.mjs','netlify/functions/upcoming.mjs','netlify/functions/delete-account.mjs','netlify/functions/supabase-health.mjs',
  'supabase/001_kinosis_041.sql','supabase/004_kinosis_0443.sql','supabase/SETUP_ALL.sql','netlify.toml'
];
for (const rel of required) assert.ok(fs.existsSync(path.join(root, rel)), `missing ${rel}`);
for (const rel of ['sw.js','manifest.webmanifest','assets/js/recommender.js','assets/css/design-0442.css']) assert.ok(!fs.existsSync(path.join(root, rel)), `${rel} should not ship in 0.4.4.5`);

const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const netlifyToml = fs.readFileSync(path.join(root, 'netlify.toml'), 'utf8');
assert.ok(netlifyToml.includes('Content-Security-Policy'), 'Netlify security headers should include CSP');
for (const marker of ['DISCOVER','ARTHOUSE','LIBRARY','MY','데이터 출처 · 이용 안내','개요','기록','통계','설정']) assert.ok(html.includes(marker), `index missing ${marker}`);
assert.ok(!html.includes('data-my="diary"'), 'Diary must be merged into Reviews');
assert.ok(!html.includes('data-my="calendar"'), 'Calendar must not be a separate My destination');
assert.ok(!html.includes('adminView'), 'Admin UI should remain absent; curations are file-authored');
assert.ok(!html.includes('serviceWorker'), 'service worker registration must not ship');
assert.ok(!html.includes('recommender.js'), 'hidden For You client should not ship');
assert.ok(html.includes('app.js?v=0.4.4.5'), 'asset cache-busting version missing');
assert.ok(html.includes('data/curations.js?v=0.4.4.5'), 'curation data bundle version missing');
assert.ok(html.includes('data/providers.js?v=0.4.4.5'), 'provider data bundle missing');
assert.ok(html.includes('hero-carousel.js?v=0.4.4.5'), 'Hero controller module missing');
assert.ok(html.includes('state-integrity.js?v=0.4.4.5'), 'state integrity module missing');
assert.ok(html.includes('data/arthouse.js?v=0.4.4.5'), 'Arthouse editorial data bundle missing');
assert.ok(html.includes('@supabase/supabase-js@2.112.3'), 'Supabase browser client must use an exact pinned version');
assert.ok(!html.includes('design-0442.css'), 'legacy visual override layer must be consolidated into app.css');

const js = fs.readFileSync(path.join(root, 'assets/js/app.js'), 'utf8');
assert.ok(js.includes("const STORAGE_KEY = 'kinosis.mvp.v2.state'"), 'storage compatibility key changed unexpectedly');
for (const marker of ['/api/movie-search','/api/upcoming','/api/movie-recommendations','/api/watchlist-availability','/api/box-office','/api/my-streaming','/api/delete-account','popstate','pushState','openCalendarDay','deleteLog','logEntryId','handleLetterboxdFiles','renderArthouse','viewingTimeline','refreshWatchlistAvailability','openCuration','renderCurationPage','fromCuration','renderHeroCarousel','pullCloudState','mergeCloudStates','/api/director-filmography','consolidatedProviders','watchAvailabilityHtml','removeMovieFromLibrary','deleteCollection','deletedLibrary','deletedCollections','cloudRevision']) assert.ok(js.includes(marker), `app missing ${marker}`);
assert.ok(js.includes('snapshotRevision'), 'cloud push must preserve mutations made while a write is in flight');
assert.ok(js.includes('mergeTombstones'), 'cloud tombstones must merge by latest timestamp');
assert.ok(js.includes('/api/upcoming'), 'thin catalog must have live KR upcoming fallback');
assert.ok(!js.includes('loadForYou'), 'unused hidden personalized recommendation loop should remain removed');
assert.ok(!js.includes('renderAdmin'), 'Admin UI logic should not ship');
assert.ok(!js.includes('Curation Studio'), 'Curation Studio should not ship; editing is file-based');
assert.ok(!js.includes('renderLibraryHome'), 'legacy Library home should be removed');
assert.ok(!js.includes('data-action="save"'), 'Library should be a result set, not a separate save action');
assert.ok(!js.includes('function saveMovie'), 'direct Library-save action should remain removed');
assert.ok(js.includes('.filter(isArthouse)'), 'Arthouse must respect classifier threshold');
assert.ok(js.includes("entry.rating = newest.find((log) => log.rating != null)?.rating ?? null"), 'rating must be fully derived from logs');
assert.ok(js.includes('getCurationLoader().ensure(item)'), 'curation loader contract missing');
assert.ok(js.includes('HERO_CAROUSEL_FACTORY'), 'Hero behavior should be delegated out of app.js');
assert.ok(js.includes('if (changed && activeView === \'curation\''), 'curation must rerender only after a real data change');
assert.ok(!js.match(/\b(prompt|confirm|alert)\s*\(/), 'native dialogs must not be used');


const searchFeature = fs.readFileSync(path.join(root, 'assets/js/features/search.js'), 'utf8');
const detailFeature = fs.readFileSync(path.join(root, 'assets/js/features/detail.js'), 'utf8');
assert.ok(searchFeature.includes('const DEBOUNCE = 250'), 'search remote debounce should be 250ms');
assert.ok(searchFeature.includes('/api/person-films'), 'person filmography API must live in Search feature');
assert.ok(searchFeature.includes('role="option"'), 'search results must expose listbox options');
assert.ok(searchFeature.includes("event.key === 'ArrowDown'") && searchFeature.includes("event.key === 'Enter'"), 'search keyboard traversal/activation missing');
assert.ok(detailFeature.includes('detail-watch-band'), 'Where to Watch must sit immediately after the film hero');
assert.ok(detailFeature.includes('내 평점'), 'personal rating hierarchy missing');
assert.ok(html.includes('role="tablist"') && html.includes('aria-controls="myContent"'), 'MY must use ARIA tab semantics');
assert.ok(js.includes("item.kind === 'director-archive'"), 'Director Archive and Editorial Curation must be distinct');
assert.ok(js.includes('letterboxdDiaryCsv') && js.includes('letterboxdWatchlistCsv'), 'Letterboxd-compatible export missing');
assert.ok(js.includes("new URL('/share'"), 'OG share route missing');

const cloud = fs.readFileSync(path.join(root, 'assets/js/cloud.js'), 'utf8');
assert.ok(cloud.includes("select('payload,updated_at,revision')"), 'cloud read must include revision');
assert.ok(cloud.includes("rpc('kinosis_write_user_state'"), 'cloud write must use atomic revision RPC');
const migration = fs.readFileSync(path.join(root, 'supabase/004_kinosis_0443.sql'), 'utf8');
assert.ok(migration.includes('pg_advisory_xact_lock'), 'sync RPC must serialize per-account writes');
assert.ok(migration.includes('expected_revision'), 'sync RPC must check optimistic revision');

const css = fs.readFileSync(path.join(root, 'assets/css/app.css'), 'utf8');
assert.ok(css.includes('.curation-card-grid') && css.includes('.library-filter-menu') && css.includes('.my-year-summary'), '0.4.4.5 surface styles missing');
assert.ok((css.match(/!important/g) || []).length <= 8, 'stylesheet cleanup should leave only reduced-motion importance guards');
assert.ok(css.includes('grid-auto-columns:calc((100% - (6 * var(--poster-gap)))/7)'), 'seven-card rail base rule missing');
assert.ok(css.includes('.detail-hero-inner'), 'film detail hierarchy missing');
assert.ok(css.includes('.watch-rows'), 'Where to Watch list design missing');
assert.ok(css.includes('content-visibility:auto'), 'render containment/performance rule missing');
assert.ok(css.includes('backdrop-filter:none'), 'expensive shell blur override missing');
assert.ok(css.includes('--font:'), 'unified font token missing');
assert.ok(css.includes('.cinema-icon-badge'), 'transparent cinema icon treatment missing');
assert.ok(css.includes('--muted-2:#8f8a82'), 'accessible muted token missing');
assert.ok(css.includes('--line-strong:#62666f'), 'interactive boundary contrast token missing');
assert.ok(css.includes('position:relative;width:44px;height:44px'), 'hero indicator hit target must be 44px');
assert.ok(css.includes('.hero-slide.is-active'), 'mounted hero slide transition missing');
assert.ok(css.includes('.provider-mark'), 'provider mark visual grammar missing');
assert.ok(html.includes('pretendardvariable-dynamic-subset.css'), 'Korean-first Pretendard stylesheet missing');
assert.ok(html.includes('This product uses the TMDB API but is not endorsed or certified by TMDB.'), 'required TMDB notice missing');
assert.ok(html.includes('JustWatch via TMDB'), 'JustWatch attribution missing');

const providerData = fs.readFileSync(path.join(root, 'data/providers.js'), 'utf8');
assert.ok(providerData.includes('\"key\": \"WATCHA\"'), 'WATCHA canonical provider missing');
assert.ok(providerData.includes('watcha-logo-white.png'), 'WATCHA official logo override missing');
assert.ok(!js.includes('watcha-logo-white.png'), 'provider-specific branding must live in provider data, not app logic');

const artClassifier = fs.readFileSync(path.join(root, 'assets/js/art-classifier.js'), 'utf8');
assert.ok(artClassifier.includes('window.KINOSIS_ARTHOUSE_DATA'), 'Arthouse classifier should read data, not own editorial seeds');
assert.ok(!artClassifier.includes("'Abbas Kiarostami','Ingmar Bergman'"), 'editorial director list should not be hardcoded in classifier logic');

for (const file of ['share','movie-search','movie-detail','box-office','movie-recommendations','person-films','director-filmography','watchlist-availability','my-streaming','upcoming','delete-account']) {
  const source = fs.readFileSync(path.join(root, `netlify/functions/${file}.mjs`), 'utf8');
  assert.ok(source.includes('rateLimit'), `${file} must have an explicit Netlify rate limit`);
}

console.log('static.test: 0.4.4.5 core UX/performance, canonical identity, curation split and export/share contracts OK');
