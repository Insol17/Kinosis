import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const required=[
  'index.html','assets/css/app.css','assets/js/app.js','assets/js/cloud.js','assets/js/ui.js','assets/js/config.js','assets/js/art-classifier.js','assets/js/recommender.js','assets/js/importers.js','assets/js/curations.js',
  'data/catalog.js','data/curations.js','data/curations.json','content/curations/README.md','scripts/build-curations.mjs','manifest.webmanifest','sw.js','icons/icon.svg','assets/branding/tmdb-logo.svg','docs/API-SOURCES.md',
  'netlify/functions/movie-search.mjs','netlify/functions/movie-detail.mjs','netlify/functions/movie-recommendations.mjs','netlify/functions/person-films.mjs','netlify/functions/watchlist-availability.mjs','netlify/functions/supabase-health.mjs',
  'supabase/001_kinosis_041.sql','supabase/SETUP_ALL.sql','netlify.toml'
];
for(const rel of required)assert.ok(fs.existsSync(path.join(root,rel)),`missing ${rel}`);
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
for(const marker of ['DISCOVER','ARTHOUSE','LIBRARY','MY','Data sources & credits','REVIEWS','STATS','SETTINGS'])assert.ok(html.includes(marker),`index missing ${marker}`);
assert.ok(!html.includes('data-my="diary"'),'Diary must be merged into Reviews');
assert.ok(!html.includes('data-my="calendar"'),'Calendar must not be a separate My destination');
assert.ok(!html.includes('adminView'),'Admin UI should remain absent; curations are file-authored');
const js=fs.readFileSync(path.join(root,'assets/js/app.js'),'utf8');
assert.ok(js.includes("const STORAGE_KEY = 'kinosis.mvp.v2.state'"),'storage compatibility key changed unexpectedly');
assert.ok(html.includes('app.js?v=0.4.3.2'),'asset cache-busting version missing');
assert.ok(html.includes('data/curations.js?v=0.4.3.2'),'curation data bundle missing');
assert.ok(html.includes('data-view="curation"'),'curation detail view missing');
for(const marker of ['/api/movie-search','/api/movie-recommendations','/api/person-films','/api/watchlist-availability','popstate','pushState','openCalendarDay','deleteLog','logEntryId','handleLetterboxdFiles','renderArthouse','viewingTimeline','refreshWatchlistAvailability','loadForYou','openCuration','renderCurationPage','curationRail','fromCuration'])assert.ok(js.includes(marker),`app missing ${marker}`);
assert.ok(!js.includes('renderAdmin'),'Admin UI logic should not ship in 0.4.3.2');
assert.ok(!js.includes('Curation Studio'),'Curation Studio should not ship; editing is file-based');
assert.ok(js.includes('requireAuth'),'account gate missing');
assert.ok(js.includes('pushCloudState'),'cloud sync missing');
assert.ok(!js.match(/\b(prompt|confirm|alert)\s*\(/),'native dialogs must not be used');
const css=fs.readFileSync(path.join(root,'assets/css/app.css'),'utf8');
assert.ok(css.includes('.arthouse-poster-row'),'compact Arthouse cards missing');
assert.ok(css.includes('.day-log-row'),'multi-log calendar day UI missing');
assert.ok(css.includes('.collection-detail-hero'),'rich collection UI missing');
assert.ok(html.includes('This product uses the TMDB API but is not endorsed or certified by TMDB.'),'required TMDB notice missing');
assert.ok(html.includes('JustWatch via TMDB'),'JustWatch attribution missing');
assert.ok(css.includes('.curation-feature'),'curation editorial component missing');
assert.ok(css.includes('.curation-page-hero'),'curation detail page styles missing');
console.log('static.test: 0.4.3.2 routing, Reviews, Arthouse density, personalization, portability and file-curation surfaces OK');
