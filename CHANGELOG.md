# Changelog

## 0.4.3.2 — File-based editorial curation

### Curation authoring
- Restored KINOSIS editorial Curation without restoring Admin/Curation Studio or database roles.
- `content/curations/discover`, `arthouse`, and `both` now act as the editorial source folders.
- Any `*.curation.json` placed in those folders is validated and indexed by `scripts/build-curations.mjs`.
- Netlify now runs `npm run build` automatically, so a Git push is enough to publish a valid curation definition.
- Added a safe authoring example and schema notes under `content/curations/README.md`.

### Product surface
- DISCOVER shows at most one editorial curation, preserving the content-first/simple home hierarchy.
- ARTHOUSE can show a compact horizontal rail of editorial curations before its algorithmic shelves.
- Curation has its own shareable `?curation=<slug>` page with hero context and ordered films.
- Movies referenced by a curation can live outside the weekly catalog cache; KINOSIS hydrates missing TMDB IDs through the existing server-side detail proxy.

### Architecture / safety
- Curation is content-as-code, not account authority: no admin client flag, no editor role, no Supabase Curation tables are required.
- Folder placement determines surface, reducing repetitive config and preventing Discover/Arthouse placement drift.
- Duplicate slugs, malformed IDs, oversized lists, invalid JSON, and duplicate movie IDs are validated at build time.
- Added `curations.test.mjs`, curation assets to the PWA shell, and cache version 0.4.3.2.

## 0.4.3 — Film-life integrity + retrieval

### MY / viewing history
- Merged Diary and Review into a single **Reviews** timeline.
- Reduced MY navigation to Overview / Reviews / Stats / Settings.
- Calendar now lives inside Overview rather than as a separate destination.
- Viewing logs can be edited or deleted.
- Rewatch is an explicit per-viewing state and viewing history is visible on movie detail.
- Each viewing keeps its own rating/review; the Library rating is recomputed from the latest viewing with a rating.
- Calendar dates with multiple films open a complete day list.

### Web navigation / film detail
- Movie pages now use `?movie=<tmdbId>` deep links.
- Browser back/forward navigation is supported with History API state.
- Film links can be copied and opened directly.
- Similar-film candidates use live TMDB recommendations/similarity, with the old local genre fallback only when necessary.

### Discover / personalization
- Added a lightweight **For You** shelf for signed-in users with enough rating history.
- Recommendation seeds come from the user's highest-rated films; KINOSIS explains the broad taste signal instead of claiming an opaque AI score.
- Watchlist provider availability is periodically checked; newly available subscription titles are surfaced in Library.

### Search
- Search now combines movie, person and common genre intent.
- Director/actor results open filmographies through a Netlify Function.

### Arthouse
- Poster rows are substantially denser and fixed-width, so a short result set no longer stretches into giant cards.
- KR now-playing sync fetches multiple pages instead of only page 1.
- Arthouse seed generation resolves curated directors to multiple actual directing credits for a wider pool.
- Current-theatre candidates are ranked with Arthouse signals first while avoiding the old two-card oversized layout.

### Library / portability
- Collections support descriptions, visual covers and explicit movie order controls.
- Letterboxd CSV import beta supports watched, ratings, diary, reviews and watchlist exports.
- Existing Watchlist × subscription dynamic behavior is preserved.

### Scope cleanup
- Removed the 0.4.2 Curation Studio/Admin product surface for now.
- Fresh Supabase setup returns to the small RLS-protected user-state + health schema; old curation SQL is kept only under `supabase/legacy/`.

### Operations
- PWA cache version bumped to 0.4.3.
- New recommendation/person/availability Netlify Functions are excluded from Service Worker API caching.
- Tests expanded for new API contracts and 0.4.3 UX markers.
