# KINOSIS 0.4.4.4 — internal review

## Release blockers addressed

1. **In-flight Cloud mutation loss** — a successful async push no longer replaces the live browser state with the older payload snapshot. `localRevision` detects edits made while the request is in flight and schedules another write.
2. **Deletion resurrection ordering** — Library, Log and Collection tombstones merge by newest timestamp per id.
3. **Curation/Search duplicate movies** — identity collapse now uses TMDB id plus normalized original-title/year across server search, person filmography, Director Curation and client rails.
4. **Víctor Erice oversized Curation** — `solo-features` validates runtime and sole Director credit, so the Erice program resolves feature films rather than every short/segment/duplicate credit.
5. **Thin Upcoming rail** — KR theatrical Discover is the canonical refresh source; a live cached Function fills a stale/thin bundled snapshot until the next catalog refresh.
6. **Detail CSS regression risk** — old detail-specific rules were removed before the 0.4.4.4 film page rules so the page no longer receives two generations of hero/gradient/layout styles.

## Film-detail product decision

The page deliberately uses the familiar poster + identity + personal actions + synopsis/cast/credits + availability hierarchy found in mature film databases and diaries. KINOSIS varies the baseline through its Korean-first typography, graphite/amber visual system, prominent personal viewing history, Arthouse state and KR theatrical/OTT availability.

It does **not** attempt to imitate WatchaPedia's community-rating scale or Letterboxd's social-review density because KINOSIS does not yet possess those network datasets.

## Deliberately not added

- Offline/PWA mode.
- Follow/feed/likes.
- AI/vector recommendation surface.
- A fifth/sixth Discover shelf.
- Admin Curation database.
- Public Arthouse classifier score/reason chips.

These do not solve current data trust, decision or recording loops.

## Remaining architecture debt

`app.js` is still larger than desirable and should be split by feature after this release is visually verified in real browsers. The next low-risk extraction targets are Discover/Arthouse rendering, Movie Detail and user Actions/state mutations. A framework migration is not required.
