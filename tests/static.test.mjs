import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const required = [
  'index.html','assets/css/app.css','assets/js/app.js','assets/js/core/store.js','assets/js/core/router.js','assets/js/core/movie-entities.js','assets/js/core/performance.js',
  'assets/js/domain/personal-state.js','assets/js/domain/personal-actions.js','assets/js/infrastructure/api-client.js','assets/js/infrastructure/movie-repository.js','assets/js/services/movie-loader.js',
  'assets/js/features/search.js','assets/js/features/detail.js','assets/js/features/library.js','assets/js/ui/movie-card.js','assets/js/cloud.js','assets/js/ui.js','assets/js/state-integrity.js','assets/js/curations.js','assets/js/curation-loader.js',
  'data/catalog.js','data/curations.js','data/curations.json','data/providers.js','data/arthouse.js','content/curations/kiarostami-life-continues.curation.json',
  'scripts/build-curations.mjs','tests/browser-smoke.mjs','netlify/functions/movie-detail.mjs','netlify/functions/movie-availability.mjs','netlify/functions/movie-summaries.mjs','netlify/functions/share.mjs',
];
for (const rel of required) assert.ok(fs.existsSync(path.join(root, rel)), `missing ${rel}`);
for (const rel of ['sw.js','manifest.webmanifest','assets/css/design-0442.css','assets/css/styles.css']) assert.ok(!fs.existsSync(path.join(root, rel)), `${rel} should not ship`);

const html = read('index.html');
const app = read('assets/js/app.js');
const detail = read('assets/js/features/detail.js');
const search = read('assets/js/features/search.js');
const library = read('assets/js/features/library.js');
const movieCard = read('assets/js/ui/movie-card.js');
const css = read('assets/css/app.css');
const detailFn = read('netlify/functions/movie-detail.mjs');
const availabilityFn = read('netlify/functions/movie-availability.mjs');
const curations = JSON.parse(read('data/curations.json'));

for (const marker of ['DISCOVER','ARTHOUSE','LIBRARY','MY','개요','기록','통계','설정']) assert.ok(html.includes(marker), `index missing ${marker}`);
assert.ok(html.includes('app.js?v=0.4.5'), '0.4.5 cache-busting missing');
assert.ok(html.includes('type="module"'), 'main browser entry must be module');
assert.ok(html.includes('https://image.tmdb.org'), 'TMDB image CDN preconnect missing');
assert.ok(html.includes('logRatingHost') && html.includes('logComment') && html.includes('logNote'), 'rating/comment/viewing-note dialog split missing');
assert.ok(html.includes('relationshipDialog'), 'current FilmRelationship editor missing');
assert.ok(!html.includes('<select id="logRating"'), 'numeric rating dropdown must be removed');
assert.ok(html.includes('role="tablist"') && html.includes('aria-controls="myContent"'), 'MY ARIA tabs missing');
assert.ok(!html.includes('data-my="diary"'), 'Diary must remain inside MY records');

assert.ok(app.includes("PERSONAL_SCHEMA_VERSION"), 'personal state schema version missing');
assert.ok(app.includes('state.relationships'), 'FilmRelationship state missing');
assert.ok(app.includes('removeMovieFromLibrary') && app.includes('deletePersonalMovieData'), 'Library remove and destructive delete must be separate commands');
assert.ok(app.includes('개인 기록은 보존됩니다'), 'Library removal semantics must be visible to users');
assert.ok(app.includes('reviewArchiveHtml') && app.includes('data-my-review-archive'), 'MY comment archive drill-down missing');
assert.ok(app.includes('curationRail') && app.includes('Director’s Archive :'), 'Collectio-style curation rails missing');
assert.ok(app.includes('ensureCurationPreview'), 'curation home must hydrate rail previews without requiring detail navigation');
assert.ok(app.includes('PERFORMANCE.mark') && app.includes('__KINOSIS_PERF__'), 'Detail performance diagnostics missing');
assert.ok(!app.includes("cache: 'no-store'"), 'client API must not defeat caching');
assert.ok(!app.match(/\b(prompt|confirm|alert)\s*\(/), 'native blocking dialogs must not be used');

assert.ok(detail.includes('data-detail-part="hero"') && detail.includes('data-detail-part="availability"') && detail.includes('data-detail-part="metadata"') && detail.includes('data-detail-part="related"'), 'Detail partial-render boundaries missing');
assert.ok(detail.includes('starRatingHtml'), 'star rating control missing from Detail');
assert.ok(detail.includes('내 한줄평'), 'current one-line comment must be prominent on Detail');
assert.ok(detail.includes('내 영화장에 담기') && detail.includes('모든 개인 데이터 삭제'), 'safe/danger movie commands must be distinct');
assert.ok(search.includes('const DEBOUNCE = 250'), 'search remote debounce should stay 250ms');
assert.ok(search.includes('setTimeout(() => prefetchFromTarget(row), 120)'), 'search hover Detail prefetch missing');
assert.ok(search.includes("event.key === 'ArrowDown'") && search.includes("event.key === 'Enter'"), 'search keyboard traversal missing');

assert.ok(html.includes('PERSONAL FILM LIBRARY') && html.includes('내 영화장'), 'Personal Film Library identity missing from Library shell');
assert.ok(!html.includes('data-library="watchlist"') && !html.includes('data-library="favorites"'), 'relationship states must not be sibling Library destinations');
assert.ok(library.includes('data-library-relationship') && library.includes('COLLECTIONS') && library.includes('MY SHELF'), 'Library IA must separate relationship filters, collections and shelf');
assert.ok(movieCard.includes("variant === 'library'") && movieCard.includes("variant === 'my'"), 'contextual Movie Card variants missing');
for (const question of ['이 영화는 무엇인가?', '지금 어디서 볼 수 있는가?', '나와 어떤 관계인가?']) assert.ok(detail.includes(question), `Detail identity question missing: ${question}`);


assert.equal(curations.version, '0.4.5');
const editorial = curations.items.find((item) => item.slug === 'kiarostami-life-continues');
assert.ok(editorial && editorial.kind === 'editorial', 'authored editorial curation missing');
assert.ok(editorial.introduction?.length >= 3, 'editorial introduction must contain substantive copy');
assert.ok(editorial.chapters?.length >= 3, 'editorial chapter structure missing');
assert.ok(editorial.chapters.every((chapter) => chapter.movies.every((movie) => movie.note)), 'editorial film notes missing');
assert.ok(curations.items.some((item) => item.kind === 'director-archive'), 'Director Archive must remain distinct from Editorial Curation');

assert.ok(detailFn.includes("append_to_response: 'credits'"), 'static Detail critical path should remain one upstream TMDB detail request');
assert.ok(detailFn.includes('Netlify-CDN-Cache-Control') && detailFn.includes('durable'), 'static Detail durable CDN cache missing');
assert.ok(detailFn.includes('Server-Timing'), 'Detail server timing diagnostics missing');
assert.ok(detailFn.includes('max-age=3600'), 'browser Detail cache should avoid needless immediate revalidation');
assert.ok(availabilityFn.includes('Netlify-CDN-Cache-Control') && availabilityFn.includes('max-age=900'), 'availability must use a shorter independent cache');

assert.ok(css.includes('.star-rating') && css.includes('.detail-comment'), 'star/comment visual system missing');
assert.ok(css.includes('.curation-rail-section') && css.includes('.curation-authored-film'), 'curation rail/detail styles missing');
assert.ok(css.includes('.review-archive-list'), 'MY review archive styles missing');
assert.ok(css.includes('.library-row-remove'), 'Library row removal affordance missing');
assert.ok((css.match(/!important/g) || []).length <= 8, 'stylesheet cleanup regressed into important overrides');
assert.ok(css.includes('content-visibility:auto'), 'render containment/performance rule missing');
assert.ok(html.includes('This product uses the TMDB API but is not endorsed or certified by TMDB.'), 'TMDB notice missing');

console.log('static.test: 0.4.5 Personal Film Library IA + Detail + contextual card contracts OK');
