# KINOSIS 0.4.5.3 — Loading / Studio / Arthouse surface pass

## Scope

0.4.5.3 applies the decisions made after 0.4.5.2 without expanding the public product into a new feature category. The two main goals are: make film data **snapshot-first and bounded**, and add an **admin-only Editorial Studio** without exposing authoring complexity to normal users.

## Movie loading

- Added `core/request-scheduler.js` with HIGH / MEDIUM / LOW lanes.
- Search and opened Detail use HIGH priority; visible hydration uses MEDIUM; prefetch, recommendations and Director refresh use LOW.
- Background LOW work is capped separately so it cannot occupy all global request slots.
- Client API requests have composed cancellation/timeouts; Detail uses an 8s budget and shows a partial slow state after 3.5s.
- `/api/movie-summaries` is now a recovery path: max 6 IDs, max 2 client chunk workers, per-film failures, browser cache + durable Netlify CDN cache.
- TMDB upstream hard timeout reduced to 6.5s.
- Director `solo-features` combines movie detail and credits with `append_to_response=credits`, removing the previous N×2 upstream pattern.
- Fresh Director snapshots skip runtime refresh for 30 days; explicit Retry still forces a refresh.

## KINOSIS Studio

- Added a hidden `STUDIO` view reachable only through the account popover for admin accounts.
- Role model is intentionally small: normal `user`; trusted `admin`; Demo remains a local session mode rather than a role.
- Client visibility uses `app_metadata.user_role=admin` only. `user_metadata` is never accepted as authorization.
- Added `supabase/005_kinosis_0453.sql` with `editorial_programmes`, RLS-protected admin writes and a public projection for Published/Archived overlays.
- Lifecycle: `DRAFT / PUBLISHED / ARCHIVED`; archive is the primary removal action.
- Editorial editor: title/description/short intro, TMDB movie search, order controls, short per-film notes, preview and publish.
- Director Archive editor: director/person ID, snapshot sync, representative hero selection, preview and publish.
- Published Studio programmes overlay Git-authored fallback definitions by slug; an archived tombstone can suppress a static fallback.

## Curation / Arthouse visual language

- Editorial Curation no longer defaults to a chapter-heavy magazine layout.
- Default public grammar: **short introduction → ordered film list → concise film note**.
- Director Archive remains a simple decade-grouped filmography.
- Removed secondary serif/editorial type treatment. KINOSIS uses one type family throughout.
- Added restrained Arthouse-only surface decoration using CSS: subtle grain/dust, inner archive frame, perforation-inspired rule and slightly stronger film-card framing.
- No copyrighted scene silhouettes are baked into the product; film imagery remains the content itself.

## Verification

`npm test` now also checks:

- request scheduler lane capacity and high-priority access;
- app-metadata-only admin claims;
- Studio DOM/network-free feature renderer;
- RLS admin policy/lifecycle contract;
- six-film summary recovery bound and durable cache;
- fresh Director snapshot TTL;
- one detail+credits Director solo-feature request;
- simplified Curation grammar and unified typography.
