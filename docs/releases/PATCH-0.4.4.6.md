# KINOSIS 0.4.4.6 Patch Notes

This patch fixes the production failures reported after 0.4.4.5 and tightens the movie-loading architecture.

## Fixed reported failures

- Film Detail no longer crashes on open because of the `isSignedIn` dependency mismatch.
- A movie route renders an explicit loading shell immediately; it cannot silently remain a blank page.
- Detail failures render a local retry state instead of relying on the global error toast.
- Library and MY no longer drop saved IDs whose TMDB metadata is not already in memory.
- Legacy cloud records hydrate movie summaries automatically in the background.
- New cloud payloads include compact stable snapshots for personal movie IDs.
- Blank loading cards are replaced with skeleton/loading states; missing/broken posters have deliberate fallbacks.

## Critical-path changes

```text
movie click
  -> immediate route + loading shell
  -> /api/movie-detail (static metadata + appended credits)
  -> usable Detail page
  -> /api/movie-availability (background)
  -> /api/movie-recommendations (background)
```

The base film page no longer waits for OTT provider lookup, KR release-date verification, or now-playing verification.

## Architecture added

- `assets/js/core/movie-entities.js` — entity normalization, personal ID discovery, placeholders, compact snapshot contract.
- `assets/js/services/movie-loader.js` — detail/availability/summary orchestration and in-flight de-duplication.
- `assets/js/features/search.js` — Search rendering/interaction.
- `assets/js/features/detail.js` — Detail rendering.
- `docs/ARCHITECTURE-0.4.4.6.md` — ownership rules, loading flows, and the next decomposition order.

## Audit fixes found beyond the report

- Removed client `cache: no-store`, which was working against the server/CDN cache policy.
- Reduced Detail's TMDB critical path from separate detail + credits calls to one appended response.
- Added the missing `collectionCover()` helper found during runtime-path review.
- Removed inline image error handlers that could not execute under the production CSP.
- Removed the unused secondary stylesheet; active CSS now lives in `assets/css/app.css` only.
- Added runtime integration tests for the exact Detail contract failure and movie-loader request de-duplication.
