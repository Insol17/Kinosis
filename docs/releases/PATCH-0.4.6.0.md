# KINOSIS 0.4.6.0

## Arthouse information architecture

- Desktop `ARTHOUSE` now exposes two explicit hover destinations: `CURATION` and `DIRECTOR'S ARCHIVE`.
- Arthouse overview no longer expands the full Director list in place. Curation and Director Archive each have their own routed Arthouse subpage.
- Director preview is capped at 35 cards and uses seven columns on wide desktop, producing the requested 7×5 presentation.
- Full Director Archive is grouped by region on its own page.
- Curation index cards were replaced with wide cinematic editorial banners. The retired Arthouse collection-card/rail CSS was removed.
- Curation also has its own `전체 보기` destination.
- Runtime Director Archive receives a stable route so refresh/share/back navigation no longer loses the director context.

## UX continuity

- Arthouse category routes are addressable through `?view=arthouse&section=curations|directors`.
- Runtime director routes use `?director=...`; browser Back returns to the originating Arthouse directory state.
- Non-overview Arthouse pages stop the hidden Hero timer rather than continuing background carousel work.
- Mobile does not depend on hover: the in-page Curation / Director Archive switcher remains the primary category control.

## API / performance

- Generic API prefetch now coalesces identical in-flight requests and suppresses immediate successful repeats for 30 seconds.
- Detail trailers + stills use one TMDB detail request with appended media instead of separate video/image requests.
- Related recommendations use `similar` only when recommendations are too sparse, instead of always issuing both calls.
- Trailer/still and related-film enrichment is lazy and starts only when the corresponding Detail sections approach the viewport.
- Runtime Director Archive no longer performs movie-detail N+1 fan-out for up to 24 candidates. `representative-features` ranks the movie-credit payload directly; exact authored Director Archives remain the canonical curated path.
- Director portraits are hydrated by a dedicated viewport controller in batches of 10 instead of loading the entire 67-person directory immediately.
- Adding one film to Watchlist now checks availability for that film only. Removing one does not rescan the Watchlist. Network-reconnect checks respect the six-hour background TTL.

## Structure / maintainability

- Added `features/arthouse-directory.js` as a pure renderer/presentation-policy module.
- Added `features/director-profile-controller.js` for viewport-aware portrait enrichment.
- Moved historical `PATCH-*.md` files to `docs/releases/` and audits to `docs/audits/`.
- Added `docs/PROJECT-STRUCTURE.md` with layer boundaries.
- No JavaScript import cycles were detected in the 33 browser JS modules during the 0.4.6.0 audit.

## Validation

- `npm test`: PASS (build, checkJs typecheck, static/domain/function/architecture/runtime/performance/calendar/snapshot suites).
- `npm run test:browser`: SKIP in the supplied execution environment because installed Chromium policy blocks local HTTP test origins.
- Local static HTTP entry and assets should be validated with `START_KINOSIS_PREVIEW.bat` or `npm run serve`; direct `file://` execution remains unsupported by native ES modules.
