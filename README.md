# KINOSIS 0.4.0 MVP

KINOSIS is a Korean-first film discovery / library / diary web MVP.

Production target: **GitHub repository + Netlify deploy + Netlify Functions + TMDB**.

## What changed in 0.4.0

- Global TMDB live movie search through Netlify Functions.
- Search checks the local KINOSIS catalog immediately, then merges TMDB results after a short debounce.
- Search results can be saved or logged without opening the detail page.
- Live-search films are persisted as movie snapshots in local state, so a saved film does not disappear when the weekly Discover catalog changes.
- Live detail fetch adds director, runtime, genres, IMDb ID and KR watch-provider data.
- Library poster cards are substantially smaller and denser than Discover cards.
- PWA shell uses versioned assets and clears old KINOSIS caches; `/api/*` is never served from the service-worker cache.
- Existing Thursday GitHub Action catalog refresh remains in place for Discover.
- Collectio remains a manually selectable subscription; KINOSIS does not invent automatic availability for it.

## Product IA

- **DISCOVER** — Home / In Theatres / My Streaming / Streaming / Top Rated
- **LIBRARY** — Steam-inspired Home shelves / compact cards / All Films / Watchlist / Favorites / Collections / Dynamic Collection / filters
- **MY** — Profile / Diary / Reviews / Ratings / Calendar / Stats / Subscriptions / Account & Data
- **SEARCH** — local-first + TMDB live search, one-click Save / Log
- **MOBILE** — touch-first bottom navigation and responsive layouts
- **PWA** — installable over HTTPS

## Production deployment: Netlify

The GitHub repository remains the source of truth. Push changes to GitHub; the connected Netlify project deploys them automatically.

### 1. Netlify environment variable

Set this in **Netlify → Project configuration → Environment variables**:

```text
TMDB_READ_ACCESS_TOKEN
```

Use the TMDB **API Read Access Token** value. Keep **Contains secret values** enabled. On plans where specific scopes are unavailable, All scopes is acceptable; Functions must be able to read the variable.

After changing an environment variable, trigger a new deploy.

### 2. Netlify Functions

This repository contains:

```text
netlify/
├─ functions/
│  ├─ movie-search.mjs   -> /api/movie-search?q=...
│  └─ movie-detail.mjs   -> /api/movie-detail?id=...
└─ lib/
   └─ tmdb.mjs
```

`netlify.toml` points Netlify at the function directory. The TMDB token exists only in the function runtime; it is never embedded in frontend JavaScript.

After deployment, verify:

```text
https://YOUR-SITE.netlify.app/api/movie-search?q=시민 케인
```

A JSON search result means Netlify → TMDB live search is working.

## Local development

### Fast UI smoke test

Double-click `index.html`.

This still works without a build step. Because `file://` cannot run Netlify Functions, search falls back to the synced/local catalog only.

### Full local Netlify test

```bash
npm run dev
```

This runs `netlify dev` through the Netlify CLI. Link the folder to the Netlify project when prompted so local functions can use the site's environment variables.

## Discover catalog sync

Live Search and Discover have different jobs.

```text
GitHub Actions -> TMDB -> data/catalog.js
               (curated Discover cache)

Browser -> Netlify Function -> TMDB
          (global live movie search)
```

The scheduled workflow `.github/workflows/refresh-catalog.yml` still runs Thursday 06:30 KST and can be triggered manually. It fetches KR now-playing / trending / streaming / top-rated data, enriches entries, validates them, then replaces the catalog only after validation succeeds.

A failed sync leaves the last known-good catalog intact.

## Personal data

0.4.0 remains anonymous/local-first. New visitors start with an empty Library and no assumed subscriptions:

- Library
- Viewing Logs
- Reviews
- Collections
- Subscriptions
- Movie snapshots required by saved live-search films

are stored in `localStorage` and can be exported/imported as JSON.

There is no fake cloud account. `supabase/schema.sql` and `docs/ACCOUNT-MIGRATION.md` remain the Phase 2 migration path for optional cross-device sync.

## Streaming semantics

KINOSIS distinguishes:

- subscription / flatrate
- free
- ads
- rent
- buy

`MY STREAMING` is computed only by intersecting the user's manually selected subscriptions with KR subscription/flatrate provider data.

Collectio is present as a manual subscription preference, but automatic title availability is not claimed until a stable permitted integration exists.

## Data-source disclosure

The website includes **Data sources & credits**.

Active sources:

- TMDB — film metadata and imagery
- JustWatch via TMDB Watch Providers — KR streaming/rental/purchase availability

Planned adapters, not active:

- KOBIS — Korean theatrical/box-office validation
- KMDb — deeper Korean film archival metadata

Read `docs/API-SOURCES.md` before adding another source.

## Tests

```bash
npm test
```

Checks:

- frontend/function JavaScript syntax
- generated catalog schema
- required product surfaces and Netlify files
- live-search/detail function contract with mocked TMDB responses
- API token is not returned in function payloads

GitHub CI runs the same checks on push/PR.
