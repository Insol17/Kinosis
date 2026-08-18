import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const required=[
  'index.html','assets/css/app.css','assets/css/design-0442.css','assets/js/app.js','assets/js/cloud.js','assets/js/ui.js','assets/js/config.js','assets/js/art-classifier.js','assets/js/importers.js','assets/js/curations.js',
  'data/catalog.js','data/curations.js','data/curations.json','content/curations/README.md','scripts/build-curations.mjs','icons/icon.svg','assets/branding/tmdb-logo.svg','docs/API-SOURCES.md',
  'netlify/functions/movie-search.mjs','netlify/functions/movie-detail.mjs','netlify/functions/box-office.mjs','netlify/functions/movie-recommendations.mjs','netlify/functions/person-films.mjs','netlify/functions/director-filmography.mjs','netlify/functions/watchlist-availability.mjs','netlify/functions/supabase-health.mjs',
  'supabase/001_kinosis_041.sql','supabase/SETUP_ALL.sql','netlify.toml'
];
for(const rel of required) assert.ok(fs.existsSync(path.join(root,rel)),`missing ${rel}`);
for(const rel of ['sw.js','manifest.webmanifest','assets/js/recommender.js']) assert.ok(!fs.existsSync(path.join(root,rel)),`${rel} should remain removed in 0.4.4.2`);

const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
for(const marker of ['DISCOVER','ARTHOUSE','LIBRARY','MY','Data sources & credits','개요','리뷰','통계','설정']) assert.ok(html.includes(marker),`index missing ${marker}`);
assert.ok(!html.includes('data-my="diary"'),'Diary must be merged into Reviews');
assert.ok(!html.includes('data-my="calendar"'),'Calendar must not be a separate My destination');
assert.ok(!html.includes('adminView'),'Admin UI should remain absent; curations are file-authored');
assert.ok(!html.includes('serviceWorker'),'service worker registration must not ship');
assert.ok(!html.includes('recommender.js'),'hidden For You client should not ship');
assert.ok(html.includes('app.js?v=0.4.4.2'),'asset cache-busting version missing');
assert.ok(html.includes('data/curations.js?v=0.4.4.2'),'curation data bundle version missing');
assert.ok(html.includes('design-0442.css?v=0.4.4.2'),'editorial design layer missing');

const js=fs.readFileSync(path.join(root,'assets/js/app.js'),'utf8');
assert.ok(js.includes("const STORAGE_KEY = 'kinosis.mvp.v2.state'"),'storage compatibility key changed unexpectedly');
for(const marker of ['/api/movie-search','/api/movie-recommendations','/api/person-films','/api/watchlist-availability','/api/box-office','popstate','pushState','openCalendarDay','deleteLog','logEntryId','handleLetterboxdFiles','renderArthouse','viewingTimeline','refreshWatchlistAvailability','openCuration','renderCurationPage','fromCuration','renderHeroCarousel','pullCloudState','mergeCloudStates','/api/director-filmography','consolidatedProviders','watchAvailabilityHtml','removeMovieFromLibrary','deleteCollection','deletedLibrary','deletedCollections']) assert.ok(js.includes(marker),`app missing ${marker}`);
assert.ok(!js.includes('loadForYou'),'unused hidden personalized recommendation loop should be removed');
assert.ok(!js.includes('renderAdmin'),'Admin UI logic should not ship');
assert.ok(!js.includes('Curation Studio'),'Curation Studio should not ship; editing is file-based');
assert.ok(!js.includes('renderLibraryHome'),'legacy Library home should be removed');
assert.ok(js.includes('.filter(isArthouse)'),'Arthouse must respect classifier threshold');
assert.ok(js.includes("entry.rating = newest.find((log) => log.rating != null)?.rating ?? null"),'rating must be fully derived from logs');
assert.ok(js.includes("element.onclick = (event) => { if (!event.target.closest('button,a')) openMovie(record.id); }"),'hero surface must open film detail');
assert.ok(!js.match(/\b(prompt|confirm|alert)\s*\(/),'native dialogs must not be used');

const css=fs.readFileSync(path.join(root,'assets/css/app.css'),'utf8');
const design=fs.readFileSync(path.join(root,'assets/css/design-0442.css'),'utf8');
assert.ok(css.includes('grid-auto-columns:calc((100% - (6 * var(--poster-gap)))/7)'),'seven-card rail base rule missing');
assert.ok(design.includes('.film-masthead'),'film detail design layer missing');
assert.ok(design.includes('.watch-options'),'Where to Watch design missing');
assert.ok(design.includes('content-visibility:auto'),'render containment/performance rule missing');
assert.ok(design.includes('backdrop-filter:none'),'expensive shell blur override missing');
assert.ok(design.includes('--font:'),'unified font token missing');
assert.ok(design.includes('.cinema-icon-badge'),'transparent icon treatment missing');
assert.ok(html.includes('pretendardvariable-dynamic-subset.css'),'Korean-first Pretendard stylesheet missing');
assert.ok(html.includes('This product uses the TMDB API but is not endorsed or certified by TMDB.'),'required TMDB notice missing');
assert.ok(html.includes('JustWatch via TMDB'),'JustWatch attribution missing');

console.log('static.test: 0.4.4.2 Korean-first visual system, transparent icons and existing UX contracts OK');
