# KINOSIS 0.4.6.0 architecture / UX / API audit

## Verified findings

### Dependency structure

- Browser JavaScript modules scanned: 33.
- Import cycles found: 0.
- `app.js` remains the largest composition unit (roughly 3.5k lines and 22 direct module imports). This is not currently a circular-dependency failure, but it is the primary maintainability risk.
- Arthouse presentation and portrait-loading responsibilities were extracted in 0.4.6.0 rather than adding more rendering/network logic to `app.js`.

### Secret boundary

A repository scan found no real TMDB/KOBIS/server secret embedded in public source. Matches were limited to `.env.example` placeholders and the deliberately fake test token. TMDB/KOBIS credentials continue to be read in trusted build/Function code.

### High fan-out calls corrected

1. Runtime Director Archive previously could issue detail calls for up to 24 candidate films in order to choose representative titles. The public representative path now uses person + movie credits and ranking signals without per-candidate detail calls.
2. Detail media previously used separate video and image requests. They are now appended to one movie request.
3. Recommendations and Similar were previously parallel defaults. Similar is now fallback-only when recommendation volume is low.
4. Search/global prefetch could request the same detail simultaneously. In-flight/short-TTL prefetch dedupe now prevents this.
5. A single Watchlist add previously forced a full Watchlist availability scan (up to 80 films). New additions refresh only the changed film.
6. Director Directory previously requested profile enrichment for every displayed director as soon as the page rendered. Portrait requests are now viewport-observed and batch-limited.

### Existing load controls retained

- Global request scheduler: 5 total / 3 medium / 2 low cap.
- Detail critical path remains separate from media/recommendation enrichment.
- Watchlist background availability has a six-hour client TTL.
- KOBIS is snapshot/build driven, not user-page-view driven.
- Function responses use CDN/browser caching according to volatility.

## Residual risks / recommended next refactor

### 1. `app.js` is still too large

The current composition root still owns cloud-sync coordination, collection dialogs, profile/calendar orchestration, Studio event plumbing and global click dispatch. It passes current tests, but adding more product surfaces directly to it will increase change coupling.

Recommended staged extraction, not a single large rewrite:

1. `features/collections-controller.js` — collection edit/picker/reorder commands and dialog coordination.
2. `services/cloud-sync-coordinator.js` — pull/push scheduling and dirty-generation policy around the existing cloud adapter.
3. `core/view-controller.js` — active view/back context/scroll restoration coordination around the existing router.

These should be extracted one at a time with existing regression tests kept green. A wholesale rewrite would create more regression risk than it removes.

### 2. Director portrait cold-cache cost is reduced, not eliminated

TMDB does not provide a bulk name-to-person-profile lookup in the current implementation. A director portrait that has never been cached can still require one person search. 0.4.6.0 avoids requesting all 67 at page entry and the Function/CDN caches results, but the long-term zero-burst solution is a trusted build-time `director-profile` snapshot with committed person IDs/profile paths.

### 3. Watchlist availability remains intrinsically per-film

A full 80-film periodic Watchlist refresh can still require one provider lookup per film. It no longer happens on every single toggle or network reconnect, but this is the next scaling constraint if KINOSIS moves from personal/portfolio traffic to a large public user base. A durable per-movie availability cache or scheduled availability index would be preferable at scale.

### 4. `my-streaming` can fan out by provider

The function resolves up to eight selected providers and may issue one Discover request per matched provider. It is CDN cached and bounded, but a future high-scale version should consider a shared provider snapshot if this surface becomes high traffic.

## UX review

- Arthouse now has a clear object taxonomy: `Curation = editorial point of view`, `Director Archive = person-centred exploration`.
- Wide Curation banners and portrait Director cards intentionally use different Gestalt similarity signals, reducing category ambiguity.
- Separate routed indexes use progressive disclosure instead of extending an already long landing page.
- Back/refresh/share context was repaired for generated Director Archives.
- Mobile retains explicit in-page category controls because hover navigation is not available on touch devices.

[Inference] These UX changes reduce visual/category ambiguity and navigation depth according to progressive disclosure, recognition-over-recall and Gestalt similarity principles. They still require real-device/user testing to verify scan speed and perceived density.
