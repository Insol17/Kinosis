# KINOSIS 0.4.4.1 — internal review

## Performance findings fixed

1. `renderAll()` previously rebuilt multiple hidden top-level surfaces. It now renders only the active view plus shared account/status chrome.
2. Arthouse landing previously could resolve every director-source curation before the user opened it. Director filmographies now resolve only inside the opened curation.
3. Live KOBIS arrival used to cause a full Discover rebuild including the Hero. It now updates only the Discover content shelves.
4. The hidden For You state was still making recommendation requests even though the 0.4.4 Discover layout no longer rendered that surface. The client recommender bundle and automatic calls were removed. `/api/movie-recommendations` remains because film detail still uses it for related films.
5. Legacy Library Home and obsolete advanced-filter branches were removed.
6. Detail images no longer request TMDB `original` backdrops; `w1280` is the upper size used by the detail Function.
7. The new visual layer avoids `backdrop-filter` on persistent shell surfaces and uses only opacity/transform for primary motion.

## P0 correctness fixed

- Rewatch status is derived from chronological viewing order after create/edit/delete.
- Current Library rating is derived from the newest rated viewing log and clears to null if no rated log remains.
- Library-film deletion and Collection deletion have cloud tombstones in addition to viewing-log tombstones.
- TMDB popularity is not displayed as box-office rank. Exact ranking requires KOBIS.
- Provider rows are consolidated by canonical service, including provider tier variants.
- Current theatrical state is a data property derived from current-theatre catalog membership, KOBIS rows, or KR theatrical release dates; there are no title-specific patches.

## Intentionally removed / deferred

- Offline/PWA Service Worker shell: removed. The product is online-first.
- Hidden For You surface: removed until there is a visible recommendation product surface again.
- Admin/Curation database: not reintroduced; Git remains the current editorial CMS.
- Social / Year in Review / account deletion server workflow: deferred because this patch is focused on current browsing/detail/performance regressions rather than new product surfaces.

## Validation

`npm test` covers browser-module syntax, static regression markers, catalog integrity, TMDB/KOBIS Function contracts, Arthouse classification and curation validation.
