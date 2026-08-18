# KINOSIS 0.3.1 MVP

A local-first, GitHub-Pages-ready film discovery / library / diary prototype.

## Run it immediately

No build is required.

1. Unzip the folder.
2. Double-click `index.html`.
3. DISCOVER / LIBRARY / MY, search, save, log, calendar, collections, subscriptions, export/import all work from `file://`.

The local build loads `data/catalog.js` with a classic script tag, so it does **not** depend on `fetch()` or ES modules to render the core UI.


## GitHub Pages quick start

This repository is build-free. Put the project files at the repository root, then:

1. Push to GitHub.
2. Open **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**.
4. Select `main` / `/(root)` and save.
5. Add the `TMDB_READ_ACCESS_TOKEN` repository secret before running the catalog refresh workflow.

`index.html` also remains directly double-clickable for local UI testing. `.nojekyll` is included so GitHub Pages serves the static project as-is.


## 0.3.1 Discover banner

The Discover hero is now presentation-first rather than a library action card:

- wide cinematic promotion layout
- no Save / Log / Detail buttons in the banner
- title logo from TMDB Images when available; otherwise Korean-safe text wrapping
- high-quality 16:9 hero backdrop chosen from TMDB movie images for likely hero candidates
- Where to Watch provider icons from TMDB / JustWatch KR availability

After deploying this version, run **Refresh movie catalog** once so the generated catalog receives `heroBackdropUrl`, `logoUrl`, and `tagline`. Existing catalogs still work through fallback fields.

**Collectio:** the service is included in MY → Subscriptions. Its website is active as an art-film OTT, but this build does not claim automatic title availability because Collectio was not found in the TMDB/JustWatch KR provider list used by KINOSIS.

## Product structure

- **DISCOVER** — Home / In Theatres / My Streaming / Streaming / Top Rated
- **LIBRARY** — Steam-inspired Library Home, shelves, All Films, Watchlist, Favorites, Collections, Dynamic Collection
- **MY** — Profile, Diary, Reviews, Calendar, Stats, Subscriptions, Account & Data
- **Search** — quick `+ Save` and `LOG` without forcing a detail-page visit
- **Mobile** — bottom navigation and touch-first responsive layouts
- **PWA** — installable when served over HTTPS

See `docs/MVP-SPEC.md` for the product rationale.


## 0.3 website polish

This revision focuses on the website itself rather than adding broad new product scope.

- Replaced font-dependent Unicode navigation glyphs with an inline SVG icon system.
- Added keyboard skip navigation and stronger focus states.
- Search now behaves as an explicit instant/autocomplete surface for the synced catalog.
- Added actionable empty states instead of dead blank panels.
- Added **MY → ACCOUNT** with clear Local Profile / Phase 2 Cloud Sync status.
- Added an in-product backup reminder after the local Library starts accumulating data.
- Export now records the last backup time.
- Mobile poster grids and touch targets were tightened for narrow screens.
- Added `npm test`, catalog/static smoke tests, and a GitHub Actions CI workflow.
- Added `CONTRIBUTING.md`, `LICENSE`, and an account migration plan.

Dark-first remains an intentional cinema-oriented brand decision; a light theme was not added merely for feature parity.

## Demo data vs live data

The repository ships with a self-contained demo catalog so the design is visible immediately. Demo posters/backdrops are original local SVG placeholders.

After TMDB sync, `data/catalog.js` and `data/catalog.json` are replaced with live metadata and TMDB image URLs.

## Generate live TMDB data

Create a TMDB API Read Access Token and set it **outside the frontend**.

PowerShell:

```powershell
$env:TMDB_READ_ACCESS_TOKEN="YOUR_TOKEN"
node scripts/update-catalog.mjs
```

macOS/Linux:

```bash
TMDB_READ_ACCESS_TOKEN="YOUR_TOKEN" node scripts/update-catalog.mjs
```

The updater:

1. fetches TMDB configuration
2. fetches KR now-playing / trending / streaming / top-rated lists
3. enriches movie detail, credits, external IDs and KR watch providers
4. retries 429/5xx responses with backoff
5. validates minimum section counts
6. replaces the old catalog only after validation succeeds

A failed sync leaves the last known-good catalog intact.

## GitHub Pages automatic refresh

Add repository secret:

```text
TMDB_READ_ACCESS_TOKEN
```

Then enable Actions write permission if the repository requires it.

`.github/workflows/refresh-catalog.yml` runs Thursday 06:30 KST and can also be triggered manually. It commits only the generated catalog files when they changed.

## Data-source disclosure

The website contains a visible **Data sources & credits** surface.

Active source policy:

- TMDB — movie metadata and imagery
- JustWatch via TMDB Watch Providers — KR availability
- KOBIS / KMDb — **not active in this build**; kept as future Korean-data adapters until their exact use conditions and integration contract are verified

Read `docs/API-SOURCES.md` before adding another source.

## Personal data

0.3 has no fake server account. User state is stored per browser using `localStorage` and can be exported/imported as JSON.

This means:

- no server cost
- no email/password storage
- no cross-device sync yet

`supabase/schema.sql` is an optional Phase 2 schema for account/cloud sync with per-user rows and RLS. Do not enable it until Auth is actually configured and tested.

## Mobile / app direction

The responsive website is the source MVP. Over HTTPS it can be installed as a PWA. If the mobile UX proves useful, the next step can wrap the same web product or migrate shared domain logic into a native shell without changing the fundamental Movie / UserFilm / ViewingLog / Subscription / Collection model.

## Official references used for the integration design

- TMDB Getting Started: https://developer.themoviedb.org/docs/getting-started
- TMDB attribution FAQ: https://developer.themoviedb.org/docs/faq
- TMDB Movie Watch Providers: https://developer.themoviedb.org/reference/movie-watch-providers
- KOFIC/KOBIS overview: https://www.kofic.or.kr/kofic/business/infm/introBoxOffice.do
- KMDb Open API guide: https://www.kmdb.or.kr/info/api/guide
