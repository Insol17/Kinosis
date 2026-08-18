# Changelog

## 0.3.0
- Website polish pass based on direct product review.
- SVG navigation/icon system; removed font-dependent navigation glyphs.
- Actionable empty states and clearer instant search messaging.
- MY → Account & Data surface with truthful local/cloud status.
- Local-data backup reminder and last-export timestamp.
- Narrow-screen Library grid/touch-target refinements.
- Accessibility skip link and icon semantics.
- Zero-dependency smoke tests + GitHub Actions CI.
- CONTRIBUTING, license status, and account migration documentation.

## 0.3.1 — Banner / imagery / OTT polish

- Reworked Discover hero into a wide promotional banner instead of a large action card.
- Removed Library / Log / Detail CTA buttons from the hero.
- Added `WHERE TO WATCH` provider logo tiles using TMDB Watch Provider logo URLs.
- Fixed Korean title wrapping with `word-break: keep-all` and length-aware title sizing.
- Added TMDB movie `images` lookup for likely hero candidates, choosing a high-quality 16:9 backdrop and Korean/English title logo when available.
- Added `tagline`, `heroBackdropUrl`, and `logoUrl` fields to generated live catalog entries.
- Fixed the poster fallback layer incorrectly covering successfully loaded poster images.
- Added Collectio (콜렉티오) to user-manageable OTT subscriptions. Collectio availability is not auto-matched because it is not currently present in the TMDB/JustWatch KR provider data verified for this build.
- Added provider-name aliases (`Watcha`/`WATCHA`, `Disney Plus`/`Disney+`, etc.) so My Streaming matching is less brittle.
- Updated GitHub Actions to checkout/setup-node v5 with Node 24.

## 0.4.0 — Netlify live search / Library density

- Added `/api/movie-search` Netlify Function backed by TMDB `search/movie`.
- Added `/api/movie-detail` Netlify Function for detail, credits, IMDb ID and KR Watch Providers.
- Added 320 ms debounced live search with Korean IME composition handling and abortable stale requests.
- Local KINOSIS search renders immediately; TMDB results merge by movie ID when available.
- Search degrades to the local catalog if the live API is unavailable.
- Live-search movies can be saved/logged directly and are persisted as movie snapshots in localStorage.
- Existing saved catalog movies are migrated into the movie snapshot cache so future Discover refreshes do not orphan Library entries.
- Reduced Library shelf/grid poster size and increased information density without changing Discover card scale.
- Added Library status/rating/My Streaming/genre/decade filters and a reset control.
- Added MY → Ratings grouped by score.
- New visitors now start with an empty Library/subscription set instead of seeded prototype records.
- Added function contract tests with mocked TMDB responses and secret-leak assertions.
- Versioned frontend assets and rewrote the service-worker strategy to clear old KINOSIS caches and exclude `/api/*` from PWA caching.
- Netlify is now the intended production host; GitHub remains source control and scheduled Discover catalog refresh.

### Attribution hardening
- Added the approved TMDB square mark to the visible About / Credits surface while keeping KINOSIS branding more prominent.
- Kept the required TMDB non-endorsement notice and explicit JustWatch attribution for watch-provider data.
