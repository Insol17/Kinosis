# KINOSIS 0.4.4 — Internal code review

## Scope

Review focused on the reintroduced editorial Curation pipeline and regression risk against 0.4.4.

## Checks performed

- Full `npm test` suite after patch.
- Syntax checks for all browser modules, Netlify Functions, service worker, and build script.
- Catalog contract test: 70 cached films still validate.
- Existing search/detail/recommendation/person/availability function contracts still pass.
- Native `prompt()` / `confirm()` / `alert()` grep remains clean.
- Admin/Curation Studio/client role code is not reintroduced.
- Secret-pattern audit found only the deliberate fake test token and `.env.example` placeholder.

## Curation-specific failure modes reviewed

### 1. Browser cannot enumerate a repository folder
Solved with a build index. Netlify runs `npm run build`, scans `content/curations`, and emits browser-readable `data/curations.js`.

### 2. Curation creates a request storm
Home surfaces hydrate only each Curation's hero movie. Opening a Curation page hydrates the ordered film list with a concurrency cap of 5 requests instead of firing the whole list at once.

### 3. Editorial film is outside the weekly 70-film cache
Missing IDs are resolved through the existing `/api/movie-detail` proxy. TMDB credentials remain server-side. Failed hydration is retryable rather than permanently poisoning the session.

### 4. Duplicate or malformed editorial data
Build fails on invalid JSON, duplicate slugs, duplicate TMDB IDs, invalid slugs/IDs, a hero movie outside the Curation list, or more than 80 films. Surface is inferred from folder location.

### 5. Deep-link navigation loses editorial context
Curation pages use `?curation=<slug>`. Movie links opened from a Curation carry `from=curation&fromCuration=<slug>` so fallback/back navigation can restore the editorial page.

### 6. PWA serves stale editorial data
0.4.4 bumps the shell cache and includes both generated Curation data and the Curation helper module. API responses remain excluded from service-worker caching.

## Deliberately not reintroduced

- Supabase `user_roles`
- Curation Studio
- editor/admin account state
- client-side `isAdmin` behavior
- Curation database tables as a runtime requirement

The old 0.4.2 SQL can remain in `supabase/legacy` without being queried.

## Remaining technical debt

The inherited `assets/js/app.js` and much of `assets/css/app.css` are still large/compact source files. New Curation data/build/helper code is kept readable, but a broader module split should be a separate refactor rather than mixed into this behavior patch.
