import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const required = [
  'index.html','assets/css/app.css','assets/js/app.js','assets/js/cloud.js','assets/js/config.js','assets/js/art-classifier.js','data/catalog.js',
  'manifest.webmanifest','sw.js','icons/icon.svg','assets/branding/tmdb-logo.svg','docs/API-SOURCES.md','netlify/functions/movie-search.mjs','netlify/functions/movie-detail.mjs','netlify/functions/supabase-health.mjs','supabase/001_kinosis_041.sql','netlify.toml'
];
for (const rel of required) assert.ok(fs.existsSync(path.join(root, rel)), `missing ${rel}`);
const html = fs.readFileSync(path.join(root,'index.html'),'utf8');
for (const marker of ['DISCOVER','LIBRARY','MY','ACCOUNT','Data sources & credits']) assert.ok(html.includes(marker), `index missing ${marker}`);
const js = fs.readFileSync(path.join(root,'assets/js/app.js'),'utf8');
assert.ok(js.includes("const STORAGE_KEY = 'kinosis.mvp.v2.state'"), 'storage compatibility key changed unexpectedly');
assert.ok(html.includes('app.js?v=0.4.1'), 'asset cache-busting version missing');
assert.ok(js.includes('/api/movie-search'), 'live search endpoint missing from frontend');
assert.ok(js.includes('library-poster-row'), 'compact library row hook missing');
assert.ok(html.includes('ART MODE'), 'ART MODE control missing');
assert.ok(html.includes('authDialog'), 'auth dialog missing');
assert.ok(js.includes('requireAuth'), 'account gate missing');
assert.ok(js.includes('pushCloudState'), 'cloud sync missing');

assert.ok(html.includes('This product uses the TMDB API but is not endorsed or certified by TMDB.'), 'required TMDB notice missing');
assert.ok(html.includes('JustWatch via TMDB'), 'JustWatch attribution missing');
assert.ok(html.includes('./assets/branding/tmdb-logo.svg'), 'TMDB logo not rendered in credits');
console.log('static.test: required files, live search and compact Library surfaces OK');
