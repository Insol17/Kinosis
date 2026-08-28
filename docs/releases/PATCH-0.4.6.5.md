# KINOSIS 0.4.6.5

## Discover

- Removed low-value gray section dividers and the Curation spotlight outline.
- Watch Now now uses landscape image cards with subscribed-provider marks only; provider prose such as `Netflix에서 감상 가능` is not shown on that surface.
- Watch Now `전체 보기` is a routed directory grouped by each subscribed provider and only uses verified availability for the grouped sections.
- Kept the four-genre preview and added a routed 12-genre directory.
- Added a full Box Office destination accepting up to 30 genuinely ranked rows. The current KOBIS daily source may provide fewer rows; KINOSIS never synthesizes ranks to fill 30.
- Increased Hero, film rail and Curation previous/next affordance visibility using neutral luminance, shape and border contrast rather than a new accent hue.
- Curation surfaces no longer show film-count metadata such as `6 FILMS`.

## Profile + settings

- Replaced the rating-distribution list with a vertical 0.5–5.0 histogram.
- Grouped provider subscriptions, Account/Sync, and data import/export into separate task panels.
- Added Profile avatar selection from cast/profile images already known to KINOSIS. Search matches character, actor and movie names; cloud state stores only the selected URL and small metadata fields. No dedicated avatar-search API or Supabase file upload was added.

## Provider marks

- Removed the old custom WATCHA SVG.
- Added first-party-hosted mark overrides for Netflix, Coupang Play, Disney+, WATCHA, Apple TV+, Prime Video, YouTube and Collectio, and extended CSP `img-src` for those hosts.
- Preserved the Apple TV store / Apple TV+ subscription identity distinction.

## Collectio

- Added `scripts/update-collectio.mjs`, `data/collectio-kr.{json,mjs}` and `.github/workflows/refresh-collectio.yml`.
- The workflow runs daily and commits only when the homepage snapshot changes.
- Runtime availability checks consult the snapshot first and fall back to the existing bounded official-site title search on a miss.
- The snapshot is explicitly scoped to the homepage and is not treated as the complete Collectio catalogue.

## Verification

- `npm test` passes: build, TypeScript checkJs, catalogue/static/functions, Arthouse/Curations, providers/availability/Collectio, personal state, Library/Collection, search/discovery, architecture/runtime, Studio, calendar and theatrical snapshot.
- Browser smoke remains skipped in this environment because the installed Chromium policy blocks local HTTP test origins.
