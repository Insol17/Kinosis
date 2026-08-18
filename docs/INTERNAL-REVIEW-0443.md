# KINOSIS 0.4.4.3 — internal review

## Release blockers addressed

1. **Director Curation render loop** — fixed with `KINOSIS_CURATION_LOADER`. A cached read returns `changed:false`; `renderCurationPage()` only repeats after a real first load. The duplicate open-path ensure call was removed.
2. **Cloud last-write race** — browser-side merge remains, but the write boundary is now atomic. Postgres serializes a user's write and validates the revision seen by the client; conflicts trigger reread → merge → retry.
3. **Provider identity drift** — brand matching/aliases/overrides moved into one data layer. WATCHA no longer uses the incorrect upstream tile in KINOSIS UI.

## Deliberately not added

- Offline/PWA mode.
- Follow/feed/likes or other social network surfaces.
- Push/email notifications.
- Year in Review.
- A new Admin/Curation database.

These do not solve the current reliability/discovery bottlenecks and would expand operational scope.

## Remaining architecture debt

`app.js` is still large. 0.4.4.3 removes two high-risk responsibilities from it (provider identity and Curation loading), but does not perform a risky all-at-once renderer/router rewrite. The next architecture pass should extract Discover/Arthouse, Library, Detail and My as feature modules after the current behavior is stable.

## Validation

`npm test` includes syntax checks plus catalog/static/Netlify/Arthouse/Curation/provider regression tests. Curation no-rerender and provider duplicate/WATCHA override behavior have dedicated tests.
