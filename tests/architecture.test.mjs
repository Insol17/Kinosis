import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync('assets/js/app.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');
const domain = fs.readFileSync('assets/js/domain/personal-state.js', 'utf8');
const actions = fs.readFileSync('assets/js/domain/personal-actions.js', 'utf8');
const repository = fs.readFileSync('assets/js/infrastructure/movie-repository.js', 'utf8');
const detail = fs.readFileSync('assets/js/features/detail.js', 'utf8');
const loader = fs.readFileSync('assets/js/services/movie-loader.js', 'utf8');
const library = fs.readFileSync('assets/js/features/library.js', 'utf8');
const arthouse = fs.readFileSync('assets/js/features/arthouse.js', 'utf8');
const movieCard = fs.readFileSync('assets/js/ui/movie-card.js', 'utf8');
const discovery = fs.readFileSync('assets/js/features/discovery.js', 'utf8');
const demo = fs.readFileSync('assets/js/domain/demo-state.js', 'utf8');
const role = fs.readFileSync('assets/js/domain/auth-role.js', 'utf8');
const studio = fs.readFileSync('assets/js/features/studio.js', 'utf8');
const scheduler = fs.readFileSync('assets/js/core/request-scheduler.js', 'utf8');

for (const importPath of ['./core/store.js','./core/router.js','./core/request-scheduler.js','./domain/personal-state.js','./domain/personal-actions.js','./domain/demo-state.js','./domain/auth-role.js','./infrastructure/api-client.js','./infrastructure/movie-repository.js','./services/movie-loader.js','./features/search.js','./features/detail.js','./features/library.js','./features/arthouse.js','./features/discovery.js','./features/studio.js','./features/calendar.js','./ui/movie-card.js']) {
  assert.ok(app.includes(`from '${importPath}'`), `app composition missing ${importPath}`);
}
assert.ok(html.includes('<script type="module" src="./assets/js/app.js?v=0.4.5.7"></script>'), 'browser entry must be a native ES module');
for (const legacy of ['features/search.js?v=0.4.5.7"></script>','core/movie-entities.js?v=0.4.5.7"></script>','services/movie-loader.js?v=0.4.5.7"></script>','features/detail.js?v=0.4.5.7"></script>']) assert.ok(!html.includes(`<script src="./assets/js/${legacy}`), `critical module still loaded as ordered global script: ${legacy}`);
assert.ok(!domain.includes('document.') && !domain.includes('fetch('), 'domain layer must be DOM/network agnostic');
assert.ok(!actions.includes('document.') && !actions.includes('fetch('), 'domain actions must be DOM/network agnostic');
assert.ok(app.includes('deletePersonalFilmData(state, id') && app.includes('removeLibraryMembership(state, id'), 'personal destructive semantics must route through domain commands');
assert.ok(!repository.includes('document.'), 'repository layer must be DOM agnostic');
assert.ok(detail.includes('patchDetail'), 'Detail view must support partial surface patching');
assert.ok(!library.includes('document.') && !library.includes('fetch('), 'Library feature renderer/filter must stay DOM/network agnostic');
assert.ok(!arthouse.includes('document.') && !arthouse.includes('fetch('), 'Arthouse selection policy must stay DOM/network agnostic');
assert.ok(!discovery.includes('document.') && !discovery.includes('fetch('), 'Discover allocation/ranking policy must stay DOM/network agnostic');
assert.ok(!demo.includes('document.') && !demo.includes('fetch('), 'Demo seed domain must stay DOM/network agnostic');
assert.ok(!role.includes('document.') && !role.includes('fetch(') && role.includes('app_metadata'), 'role policy must stay domain-only and use app_metadata');
assert.ok(!studio.includes('document.') && !studio.includes('fetch('), 'Studio authoring renderer must stay DOM/network agnostic');
assert.ok(scheduler.includes('maxLowConcurrent') && scheduler.includes('activeByPriority'), 'global request scheduler must reserve capacity from background work');
assert.ok(!movieCard.includes('document.') && !movieCard.includes('fetch('), 'Movie Card renderer must stay DOM/network agnostic');
assert.ok(loader.includes('const fresh = getMovie(key)'), 'concurrent data layers must merge into the freshest entity');
assert.ok(app.indexOf('renderMoviePage(record);') < app.indexOf('const detailPromise = ensureMovieDetail'), 'known movie entity must paint before network detail is awaited');
assert.ok(app.includes("patchMoviePage(updated, ['availability', 'hero'])"), 'availability may not trigger a full Detail rerender');
assert.ok(app.includes("patchMoviePage(movie(id), ['related'])"), 'recommendations may not trigger a full Detail rerender');

console.log('architecture.test: explicit module layers + Studio authorization boundary + scheduled network hierarchy OK');
