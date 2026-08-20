# Changelog

## 0.4.5.8
- OTT availability now carries source/confidence provenance instead of treating TMDB/JustWatch rows as real-time truth.
- Added direct Collectio official-catalogue verification with exact title/year matching and bounded cache/timeout.
- Confirmed vs external-DB availability is separated in detail, watchlist and Discover claims.
- Verified manual corrections can upgrade duplicate stale aggregator rows.

## 0.4.5.7
- Watchlist utility overview + explicit full-list route.
- Personal schema v9 adds `watchlistedAt`.
- Correct current-theatre semantics and provider partial-failure preservation.
- Timestamped availability verification supplement for known third-party gaps.
- Discover landscape Watch Now strip and visual genre browse.


## 0.4.5.6

- Made Director Archives explicit admin-selected film programmes and required per-film editorial notes for Curation.
- Rebuilt `그럼에도 삶은 계속된다` with six cross-director films and authored explanations.
- Added Studio rich film search and direct Hero image picker.
- Moved Discover Curation promotion out of Hero into an inline programme banner.
- Preserved KOBIS rank #1, added state-aware rail arrows, personal ratings on cards, and removed card OTT badges.
- Added WATCHA compact W mark, trailers/stills in Detail, stable Library switching, compact Profile UI and programme-to-Collection save.
- Expanded Arthouse film/archive visual language and replaced the KINOSIS app icon with a film-frame mark.
- Added build-time programme movie snapshot enrichment so programme imagery is available before Detail is opened.

## 0.4.5.4

- Moved Korean theatrical data to a scheduled KOBIS→TMDB snapshot pipeline so browser traffic does not consume KOBIS quota.
- Added persistent KOBIS↔TMDB mapping and preserved unmatched KOBIS rows.
- Added build-time Director Archive snapshot hydration and removed normal public Arthouse dependence on live filmography assembly.
- Reworked Studio loading: immediate shell, lightweight list, lazy payload, local save/archive patch, direct draft preview and sync progress.
- Simplified Curation to a film-collection object with optional ordering/notes and flattened legacy chapters.
- Unified typography while adding restrained Arthouse grain/frame/perforation surface treatment.
- Fixed transient star-rating hover state.
- Rebuilt Profile calendar with cinematic landscape stills, deterministic multi-film lead selection and mobile agenda.
- Added Supabase Studio summary-column migration `006_kinosis_0454.sql`.

## 0.4.5.3 — Bounded movie loading / admin Studio / unified Arthouse surface

### Loading architecture
- Added a global HIGH/MEDIUM/LOW request scheduler so Search and opened Detail are not starved by prefetch, Archive refresh or bulk hydration. Background LOW work is capped independently.
- Reduced the summary recovery path from 20-film multi-wave work to six-film batches, two browser workers, partial failures and durable CDN caching.
- Added an 8-second Detail client budget and a 3.5-second partial slow state; known film/personal data remains visible while external metadata is late.
- Reduced TMDB hard timeout to 6.5 seconds and changed Director `solo-features` authoring from separate detail+credits calls to one `append_to_response=credits` call per candidate.
- Fresh Director snapshots skip automatic live refresh for 30 days; stale/manual refresh remains explicit low-priority enrichment.

### Admin-only KINOSIS Studio
- Added the hidden Studio surface for accounts with trusted Supabase `app_metadata.user_role=admin`. Demo remains a local mode, not an account role.
- Added `supabase/005_kinosis_0453.sql`: `editorial_programmes`, Draft/Published/Archived lifecycle, admin-only RLS writes and a public Published/Archived projection.
- Added Editorial and Director Archive authoring flows, TMDB film search, order/note editing, Director snapshot sync, preview, publish and archive.
- Dynamic published definitions override Git fallback definitions by slug; archived tombstones can suppress a static programme without deleting source history.

### Curation / Arthouse design
- Simplified Editorial Curation to short introduction + ordered films + concise film notes. New content no longer uses forced magazine-style chapters.
- Kept Director Archive as a compact decade-grouped filmography.
- Unified typography across all KINOSIS surfaces. Arthouse differentiation now comes from a restrained film/archive surface layer—grain, thin frame, perforation rule and film-card framing—rather than a separate font family.

### Quality
- Added regression coverage for trusted admin claims, Studio/RLS lifecycle, request lane capacity, summary batch bounds, fresh-snapshot TTL, single-request Director filtering and the simplified Curation grammar.


## 0.4.5.2 — Coherence / Arthouse reliability / portfolio demo

### Personal Film Library rules
- Upgraded personal state to schema v8. Watchlist-only remains outside `전체 영화`, while a current rating, one-line comment, favorite, new viewing or Collection membership promotes the film into the current shelf.
- Promotion is a migration/action rule rather than a perpetual normalize rule, so manually removing a film from the shelf does not silently re-add it on reload.
- Demoted manual `영화장에 보관` to the Detail overflow menu. Library membership remains available for explicit save-without-engagement cases.
- Fixed create-from-film Collection flow so a newly created Collection actually contains the pending film.
- Letterboxd imports now follow the same shelf semantics: rating/review/watched entries enter the shelf; watchlist-only entries do not.

### Viewing / Detail integrity
- Separated the current FilmRelationship editor from ViewingEvent history editing. A historical log opens its own `ratingSnapshot` and note; editing it no longer rewrites the current rating.
- New viewing events may update the current rating and automatically enter the shelf; editing an old event does not resurrect a later manual shelf removal.
- Kept favorite visible as a secondary Hero action and removed duplicated relationship controls from the viewing dialog.
- Kept user-facing Detail labels terse (`작품 정보 / 감상 가능 / 내 기록`) and removed redundant director/basic-fact duplication.

### Arthouse
- Removed the generic `최근 공개된 작가영화` and misleading `다시 볼 만한 작품` rails. Arthouse is now entirely programme-driven.
- Rebuilt the Hero as one representative slide per Editorial/Director Archive programme, with curation-aware navigation instead of `artPool().slice(0,5)`.
- Director Archive definitions now use stable person IDs and ship static movie snapshots. Runtime loading renders the snapshot immediately, then attempts live enrichment.
- Added explicit curation loader states (`idle/loading/ready/empty/error`), retry, request dedupe and snapshot preservation; a failed network request is no longer cached as a successful empty filmography.
- Director filmography responses now carry `director` and `directorId`, and Movie Entity enrichment preserves director/runtime/metadata fields across lightweight merges.

### Discover / Search / Profile
- Added curation-capable Discover Hero slides and varied movie Hero allocation across featured/box-office/upcoming/rated sources.
- Added cross-section visible allocation so Hero and adjacent rails do not repeatedly spend the same first viewport on the same films.
- Replaced raw-average high-rated ordering with confidence-weighted ranking.
- Search keeps explicit spinner/skeleton feedback, uses one main ARIA option per result row, closes before Detail and restores the prior query/results on return.
- Unified PROFILE navigation: the avatar opens an account popover instead of jumping directly to Settings; Profile counters now distinguish 감상 영화 / 평가 / 한줄평 / 컬렉션 and open matching archives.
- Runtime statistics mark incomplete runtime metadata instead of silently pretending missing runtime is zero.

### Portfolio / regression cleanup
- Added `KINOSIS 둘러보기`, a session-only seeded demo mode with Cloud reads/writes disabled.
- Fixed the stale Hero-dot CSS rule that painted the entire active hit target as a large amber block.
- Removed obsolete status-pill CSS and dead Library/watchlist branches, and added Discovery allocation regression tests.
- Editorial Studio remains deferred; reviewer-facing product coherence remains the priority for this portfolio build.

## 0.4.5.1 — Arthouse / Library / Profile product polish

### Arthouse
- Expanded the source pool with hydrated Director Archive and Editorial films instead of ranking only the small static catalogue.
- Lowered broad auteur/director seeds to a supporting classifier signal and raised the threshold so titles such as `기생충` or `센과 치히로의 행방불명` are not admitted from director identity alone.
- Replaced the Tarantino archive with Christian Petzold and suppressed repeated programmed films across generic Arthouse rails.
- Removed duplicate Director Archive labels.

### Library / Detail
- Added a dedicated `보고싶어요` Library surface while keeping watchlist-only films out of the present-tense `전체 영화` shelf.
- Added proper first-use Library empty state and watchlist count/empty state.
- Removed conversational/internal Detail questions and reduced the visible structure to `작품 정보 / 감상 가능 / 내 기록`.
- Kept rating/comment/actions in the hero and removed the redundant lower relationship-state summary.

### Loading / stability
- Added stronger Search spinner/skeleton feedback, reduced remote debounce to 180ms, expanded card Detail prefetch and parallelized summary hydration.
- Preserved enriched provider/cast/genre data during lightweight entity merges so provider badges do not disappear during progressive rerenders.
- Added provider loading placeholders while availability owns a pending state.

### Profile / navigation / visual polish
- Consolidated the public personal surface under `PROFILE`; the old `MY` name remains only as an internal route key.
- Rebuilt viewing-history row layout and the monthly viewing calendar with poster-filled days.
- Added desktop previous/next rail controls and removed dependence on visible horizontal scrollbars.
- Strengthened the catalogue/archive visual hierarchy without introducing a new visual system.
- Deferred Editorial Studio/CMS until the reviewer-facing surfaces are stable.

## 0.4.5 — Personal Film Library identity pass

### Product identity / IA
- Reframed KINOSIS around **Personal Film Library / 나만의 영화장** rather than a collection of discovery, curation and logging features.
- Library now treats `LibraryMembership` as the present-tense shelf. Watchlist, favorite and rating are relationship filters rather than sibling Library destinations.
- Collections remain user-authored organization and are visually separated from relationship state.
- No physical/digital ownership model was added; current access remains subscription/theatrical availability only.

### Library
- Rebuilt the Library landing around `PERSONAL FILM LIBRARY → COLLECTIONS → MY SHELF`.
- Added relationship filter chips (전체 / 보고싶어요 / 좋아요 / 평가함), with watched/rating/genre/availability kept as secondary filters.
- Added compact collection rail plus dedicated full-collection view.
- Library cards now expose personal context: current rating, viewing count, current subscribed-provider access and collection membership.
- MY cards use a different context emphasizing viewing time/history instead of reusing the Library card semantics.
- Library removal continues to remove only membership; rating, one-line comment, viewing events, watchlist/favorite and collection links are preserved.

### Detail
- Reorganized Detail around three explicit product questions: **이 영화는 무엇인가? / 지금 어디서 볼 수 있는가? / 나와 어떤 관계인가?**
- Promoted `내 영화장에 담기` to a visible primary relationship action beside viewing-log and watchlist actions.
- Kept current star rating and one-line comment prominent in the hero while the MY FILM section owns membership, relationship state, collections and viewing history.
- Preserved independent partial-render boundaries for metadata, availability and personal activity so background responses do not rerender the full page.

### Architecture / quality
- Extracted Library filtering/render policy into `assets/js/features/library.js`.
- Extracted surface-specific movie-card policy into `assets/js/ui/movie-card.js`.
- Critical rendering policy remains DOM/network agnostic; `app.js` owns composition and event delegation.
- Added Library contextual-card regression tests and extended architecture/static/runtime contracts for the 0.4.5 IA.

## 0.4.4.7 — Personal film model / fast Detail / curated film-life UX

### Data model
- Split durable personal film state into LibraryMembership, FilmRelationship and ViewingEvent (schema v7), with automatic migration from legacy 0.4.4.x library/log rating and review fields.
- Library removal now deletes membership only; rating, one-line comment and viewing events survive. A separate confirmed destructive action removes all personal data for a film.

### Detail / performance
- Detail paints immediately from the movie entity already known by Search/rails/Library, then concurrently hydrates static metadata, availability and recommendations.
- Async Detail results patch only their owned regions instead of replacing the whole page; concurrent responses merge against the freshest entity.
- Added bounded Search hover/focus prefetch, client performance diagnostics, Server-Timing, browser caching and Netlify durable CDN caching for the static Detail path.

### Rating / MY / Library
- Replaced numeric rating selection with an accessible five-star, half-step rating control and promoted the current one-line comment into the primary Detail relationship surface.
- Separated current film comment from per-viewing notes and historical rating snapshots.
- Added MY one-line-comment drill-down/archive without another global navigation category.
- Added direct Library removal actions with non-destructive semantics.

### Arthouse / architecture
- Reworked Arthouse around Collectio-style curation rails while preserving the Director Archive vs Editorial Curation domain boundary.
- Added the authored editorial `그럼에도 삶은 계속된다` with introduction, chapters and film notes.
- Converted the critical browser path to native ES modules and introduced explicit domain / infrastructure / service boundaries.
- Added `checkJs` type checking plus personal-state, architecture and loader race/de-duplication regression tests.

## 0.4.4.6 — Reliability / entity hydration architecture

### P0 runtime fixes
- Fixed the film-detail crash that produced the generic global error toast. `app.js` supplied `isSignedIn` as a boolean while the extracted Detail feature called it as a function; the call site now supplies the callback and the feature defensively accepts either contract.
- Added a runtime regression test that executes the Detail renderer rather than only checking source markers, so this exact integration failure is now covered.
- Added a localized Detail loading/error surface. Selecting a search result changes route immediately and shows a poster/skeleton/loading indicator instead of leaving an apparently blank page. Timeout/rate-limit failures expose Retry without destroying search or personal state.

### Library / MY entity hydration
- Personal movie IDs from Library, Logs and Collections no longer disappear when movie metadata is absent. Missing entities render explicit loading placeholders.
- Cloud Sync now carries compact stable movie snapshots for only the films referenced by personal data. This restores title/year/poster on a fresh device without requiring the user to open each movie first.
- Added `/api/movie-summaries` for legacy cloud payloads that contain IDs but no snapshots. Library/MY render first, then hydrate missing movie metadata in the background.
- Availability/provider state remains volatile and is intentionally excluded from compact cloud snapshots.

### Detail critical path
- Split volatile provider/theatrical work into `/api/movie-availability`; it no longer blocks the base film page.
- `/api/movie-detail` now uses one TMDB detail request with appended credits instead of separate detail + credits round trips.
- Detail, availability and batch-summary requests share in-flight promises so repeated clicks/renders do not duplicate network work.
- Static film metadata keeps a long cache horizon while availability uses a shorter horizon.
- Removed the client-wide `cache: no-store` request mode that was undermining the server/CDN cache strategy.

### Loading / media resilience
- Replaced blank poster cards with explicit metadata-loading skeletons in Library, MY and cards.
- Added Library metadata-sync status and retry UI.
- Missing search/detail poster art uses intentional placeholders rather than empty image elements or the KINOSIS app icon.
- Removed inline image error handlers that were ineffective under the production CSP; image fallback is handled through delegated listeners.
- Added the previously missing `collectionCover()` helper discovered during the audit.

### Architecture / audit
- Added `assets/js/core/movie-entities.js` for canonical entity normalization, personal-ID discovery, loading-placeholder behavior and compact snapshot rules.
- Added `assets/js/services/movie-loader.js` as the request orchestration layer, leaving Search/Detail feature rendering independent from network de-duplication.
- Added `docs/ARCHITECTURE-0.4.4.6.md` documenting data ownership, critical paths and the staged `app.js` decomposition plan.
- Removed an unused secondary stylesheet and kept the active visual cascade in `assets/css/app.css`.

## 0.4.4.5 — Core UX / performance pass

### Search
- Split Search into `assets/js/features/search.js` and rebuilt it as an instant-local + 250 ms live-merge search product.
- Results distinguish people from movies, rank exact/prefix matches first, expose an exact-match section and support Arrow Up/Down + Enter navigation through ARIA combobox/listbox semantics.
- Movie identity is canonical by TMDB movie id. Normalized original-title/year is used only as a fallback when an external record has no TMDB id, so distinct same-title films are never collapsed.

### Film detail / availability
- Split Detail into `assets/js/features/detail.js` and rebuilt the page around title/meta → personal actions/rating → Where to Watch → synopsis → director/cast → personal record → facts → related films.
- TMDB rating is secondary reference data; KINOSIS personal state is the primary relationship signal.
- `/api/movie-detail` now separates 24 h static metadata cache from 4 h availability cache. KR now-playing validation is only requested for genuinely recent theatrical releases.

### Arthouse / curation
- Added explicit `editorial` and `director-archive` curation kinds. Editorial objects must own explicit movie ids/chapters; director auto-sources can no longer become editorial source of truth.
- Arthouse now indexes editorial collections and Director Archives as collection cards instead of expanding every curation into a home rail.
- Editorial chapter rendering supports numbered sections and explicit movie membership.

### Library / MY / portability
- Simplified Library around retrieval: query, sort, view mode and an on-demand filter panel for watched state, rating, genre and current availability. Sidebar collections are capped to recent/pinned items.
- MY uses actual ARIA tabs with keyboard traversal. Overview is reduced to yearly total, recent watches, recent records and calendar; statistics stay in Stats and subscriptions stay in Settings.
- Data export now offers full KINOSIS JSON plus Letterboxd-compatible Diary and Watchlist CSV files.

### Sharing / architecture / CSS
- Added `/share` OG HTML for movie and curation links so copied public links can render poster/title preview cards before redirecting into KINOSIS.
- Centralized the current Korea product locale (`KR`, `ko-KR`) for client/server use without adding country-selection UI.
- Consolidated the accumulated stylesheet cascade, reduced `!important` usage to reduced-motion exceptions, and added dedicated 0.4.4.5 rules for curation cards, retrieval filters, film detail hierarchy, MY and search.

## 0.4.4.4 — Film detail, data integrity and duplicate control

### Film detail
- Rebuilt the film page around a mature film-service hierarchy: poster/backdrop, title/original title, director/year/runtime/genres, primary personal actions, personal rating, synopsis, portrait cast, credits/facts, Where to Watch and related films.
- Personal KINOSIS state is visually stronger than the external TMDB score; TMDB remains secondary reference data.
- Added cast portraits, writer/cinematography facts and provider freshness text.
- Where to Watch distinguishes confirmed current theatrical state from merely recent theatrical release and keeps provider rows informational with one clear external availability CTA.
- Removed legacy detail CSS rules that were still layering an obsolete gradient/layout under the new detail UI.

### Curation / search correctness
- Search, client rails, person filmographies and Director Curations collapse duplicates by TMDB id plus normalized original-title/year identity.
- Added Director Curation modes. `solo-features` fetches movie detail/credits and keeps only feature-length films where the selected person is the sole credited Director.
- Víctor Erice's collection now uses `solo-features`, preventing shorts/anthology segments/duplicate records from turning a four-feature collection into an oversized list.
- Curation source definitions support `personId`, `include` and `exclude` as editorial overrides without title-specific application logic.

### Cloud integrity
- Added a local mutation generation (`localRevision`) check around async Cloud writes so edits made while a write is in flight are never replaced by the older network snapshot.
- Tombstone merges now retain the newest deletion timestamp per id.
- Cloud payloads exclude replaceable `movieCache` and availability snapshots; opening a Log/detail path no longer schedules Cloud sync just because metadata was cached.
- Added a small `state-integrity.js` module and regression tests for tombstone ordering and in-flight mutation generations.

### Discovery data
- Upcoming catalog refresh now uses TMDB Discover for KR theatrical releases over the next 120 days, preferring full theatrical release dates (`3|2`).
- Added cached `/api/upcoming` live fallback when the bundled weekly catalog cannot fill the seven-card Upcoming rail.
- Weekly catalog validation now requires seven items for visible Discover rails instead of accepting obviously thin three-item data.
- The theatrical detail state no longer equates a recent theatrical release date with confirmed current exhibition; TMDB KR now-playing is used for current state.

### Interaction / architecture
- Hero uses carousel semantics, a dedicated movie-open control, touch swipe and keyboard-friendly autoplay behavior.
- Shared provider and Arthouse editorial definitions are generated from `shared/providers.mjs` and `shared/arthouse.mjs` rather than duplicated client/server hardcoded lists.
- Letterboxd import spaces title matching requests under the public search rate limit and retries 429 responses with backoff.
- MY's review/history destination is labeled `기록`, and automatic Cloud sync is simplified in Settings with diagnostics under an advanced disclosure.

## 0.4.4.3 — Stability, sync concurrency and provider identity

### P0 stability
- Fixed the Director Curation microtask render loop by moving dynamic loading behind a cache contract that reports whether data actually changed. Cached reads do not trigger a rerender.
- Added a dedicated regression test proving a Director Curation fetch happens once and a cached `ensure()` returns `changed:false`.
- Removed a second redundant `ensureCurationMovies()` call from the open-Curation path.
- Added a global `error` / `unhandledrejection` fallback with a recoverable KINOSIS toast.

### Cloud Sync
- Added `user_state.revision` and `kinosis_write_user_state(expected_revision, new_payload)` in `supabase/004_kinosis_0443.sql`.
- Per-account writes are serialized in Postgres and reject stale revisions instead of silently last-write-wins overwriting another device.
- The client now rereads, merges and retries when a revision conflict is detected.
- Added server-side account deletion (`/api/delete-account`); it validates the user's bearer token before using `SUPABASE_SECRET_KEY`.

### Discover / streaming / theatrical
- `내 구독 서비스에서` now uses `/api/my-streaming` and TMDB KR provider discovery instead of filtering only the weekly Discover catalog.
- Movie detail keeps the KR release-date signal and, when that does not say current, checks TMDB KR `now_playing` before treating a film as not currently theatrical.
- Public TMDB/KOBIS proxy Functions now carry explicit Netlify IP rate limits.

### OTT provider identity
- Added `data/providers.js` + `assets/js/providers.js` as the canonical provider mapping layer.
- Consolidates provider variants such as Netflix and Netflix Standard with Ads into one brand entry.
- Corrected WATCHA branding with the official transparent WATCHA wordmark from the WATCHA media kit; the override lives in provider data, not hardcoded render logic.
- Provider art uses transparent containers and `object-fit: contain` to prevent cropping or black icon tiles.

### UX / visual maintenance
- Consolidated the separate `design-0442.css` layer into `app.css` so visual behavior is no longer dependent on a second specificity override sheet.
- Raised low-contrast secondary tokens and increased interactive pointer targets to at least 44px without visually inflating the icons.
- Added mounted Hero slides, pause/play control and opacity/transform transitions instead of rebuilding Hero markup on every autoplay step.
- Removed the separate direct Library-save action; Watchlist, viewing logs, Favorite and Collections establish Library membership automatically.
- Moved Arthouse editorial seeds to `data/arthouse.js` so classifier behavior is code/data separated.

## 0.4.4.2 — Korean-first visual redesign

### Visual system
- Replaced the previous mixed editorial/system typography with one Korean-first Pretendard-based type system across navigation, cards, detail, Library and MY.
- Increased small UI copy to readable Korean-oriented sizes; removed most 8–10px microcopy from the active visual layer.
- Preserved DISCOVER / ARTHOUSE / LIBRARY / MY layouts while rebuilding spacing, hierarchy, radii, borders and component surfaces.
- Flattened dashboard-like cards in film detail and MY into a continuous editorial page rhythm separated by rules and whitespace.
- Replaced heavy black/glass chrome with graphite surfaces and transparent icon controls.

### Icons / brand
- Rebuilt the inline SVG sprite with a consistent rounded-stroke icon grammar.
- Added dedicated chevron icons for Hero navigation instead of text glyph arrows.
- Rebuilt the KINOSIS brand mark with a transparent background and regenerated PNG/ICO variants with alpha.
- Cinema and utility icons no longer sit on black square/circular backgrounds; provider logos remain their own brand artwork.

### Korean UX copy
- Library secondary navigation is now Korean-first: 전체 영화 / 보고싶어요 / 좋아요 / 컬렉션.
- MY tabs are now 개요 / 리뷰 / 통계 / 설정.
- Film-detail actions use Korean labels such as 감상 기록 / 보고싶어요 / 좋아요 / 컬렉션.
- Korean copy uses `word-break: keep-all` and larger body/metadata sizing to avoid awkward word fragmentation.

### Cleanup / regression fixes
- Removed the stale `recommender.js` script include that remained after the hidden recommender client was deleted.
- Replaced the unused 0.4.4.1 visual layer file with `design-0442.css` and updated the static regression tests accordingly.
- Long content sections retain paint containment and reduced-motion behavior.

## 0.4.4.1 — Detail, performance and theatrical-data pass

### Performance / cleanup
- Removed Service Worker / manifest offline shell and the unused hidden For You client loop.
- Render only the active top-level surface instead of rebuilding Discover, Arthouse, Library and MY together.
- Arthouse landing no longer resolves director filmographies; a curation resolves its dynamic source only when opened.
- Live box-office arrival updates only Discover content and no longer rebuilds the Hero.
- Removed legacy Library Home and obsolete advanced-filter code paths.
- Detail backdrops are capped at TMDB w1280 instead of `original`.
- Added `content-visibility` containment and removed expensive shell/toolbar backdrop blur in the 0.4.4.1 visual layer.

### Box office / theatrical state
- Added `/api/box-office` backed by the official KOBIS daily box-office API.
- TMDB popularity is never presented as a box-office rank. If KOBIS is unavailable the UI shows an unranked `현재 상영작` shelf.
- KOBIS Korean opening dates are preferred for matched box-office titles.
- Film detail now reads KR theatrical release dates and exposes current/upcoming theatrical state generically; no movie-title-specific patches are used.

### Film detail / Where to Watch
- Rebuilt film detail into a stronger editorial information page with masthead, actions, rating, synopsis/facts, cast, personal history and related films.
- Whole Hero surfaces now open the corresponding film detail.
- Where to Watch is an inline full-width surface rather than a cramped side utility.
- Provider variants are consolidated by canonical brand, removing duplicate Netflix/ad-tier tiles.
- Current theatrical films show a `극장 · 현재 상영 중` option even when there is no OTT provider.
- Director and genre values are direct exploration actions.

### P0 data integrity
- Rewatch flags are recalculated from chronological viewing history after create/edit/delete.
- Current Library rating becomes null when no rated viewing log remains instead of preserving a stale value.
- Complete Library-film removal and Collection deletion now have cloud tombstones so stale devices do not resurrect them.

### Motion / visual system
- Added a new `editorial-0441.css` layer: warmer cinema typography, stronger hierarchy, restrained section/view/Hero transitions, film-card hover behavior and a redesigned detail surface.
- Motion uses transform/opacity and honors `prefers-reduced-motion`.

## 0.4.4 — Discovery rails, reliable cloud sync, simpler Library

### Discover
- Featured is now a 3–5 film carousel with arrows, indicators, 6.5s autoplay, hover/focus pause, and reduced-motion opt-out.
- Default section order is now: Box Office / Upcoming / My Services / Highly Rated.
- Added generated `boxOffice` and `upcoming` catalog sections.
- Exact Korean daily box-office ranks use optional KOBIS data. Without a KOBIS key, KINOSIS falls back to TMDB theatrical popularity and labels the shelf `극장 인기 순위` rather than inventing box-office ranks.

### Arthouse
- Uses the same carousel and poster-card grammar as Discover.
- Default order is Latest Releases / Highly Rated / four Arthouse curations.
- Removed the sparse `지금 아트시네마에서` rail and the separate compact Arthouse card sizing.

### Poster density
- Desktop horizontal rails are capped at exactly seven visible poster cards within the 1600px content shell.
- Wider monitors do not reveal additional cards; they preserve the same seven-card composition.
- Library and curation grids also cap at seven columns on desktop.

### Library
- Removed Library Home, stats cards, explanatory feed sections, and the large multi-filter bar.
- Default Library opens directly to All Films.
- Steam-like left navigation: All Films / Watchlist / Favorites / Collections + personal collection shortcuts.
- Main surface keeps only search, sort, Grid/List view, and the selected library content.

### Cloud Sync v2
- Sync is now bidirectional instead of push-only after initial login.
- Pulls cloud state on focus, visibility return, reconnect, manual sync, and a low-frequency foreground interval.
- Before a push, KINOSIS checks for a newer remote row and merges item-level timestamps instead of blindly overwriting another device.
- Added viewing-log deletion tombstones so a deleted log does not reappear from another device's stale state.
- Added subscription and profile update timestamps for safer conflict resolution.
- Cloud Settings now exposes the actual Supabase error message; missing schema/RLS errors are translated into actionable messages.

### Curations
- Curations remain Git-authored and Arthouse-only; no Admin account is required.
- `source.type = "director"` can now resolve every TMDB movie directing credit for a named director at runtime.
- Added four built-in Director's Archives:
  - 그럼에도 삶은 계속된다: 키아로스타미 컬렉션
  - 셀룰로이드의 정령: 빅토르 에리세 컬렉션
  - 파도치는 시대를 관조하는 시선: 허우샤오시엔 컬렉션
  - 폭발하는 도파민: 쿠엔틴 타란티노 컬렉션
- Director curations auto-expand when TMDB adds a new directing credit; static TMDB-ID curation files remain supported.

### Operations
- Added `/api/director-filmography` Netlify Function.
- Catalog refresh supports optional `KOBIS_API_KEY` GitHub Secret.
- PWA cache version bumped to 0.4.4.
