# KINOSIS 0.4.6.2

## Library / Collections

- Collection detail now owns the full edit loop: search KINOSIS, add a film, keep searching, or remove an existing film without leaving the collection.
- Search results expose `+ 추가` / `- 제거` according to current membership.
- Existing collection films expose an explicit `컬렉션에서 제거` action in normal browse mode; deletion is no longer hidden behind order editing.
- Global Search exposes `+ 영화장`, and Library exposes `+ 영화 찾기`, reducing navigation hops when building the shelf.
- Collection mutation rules were extracted into `assets/js/features/collection-editor.js` and covered with pure regression tests.

## Profile / Movie Detail

- User-facing `한줄평` terminology is replaced with `리뷰`.
- Movie Detail no longer renders rating/review as a detached third-column relationship card. `내 평가` and `내 리뷰` sit beneath the film's primary information/actions as one personal-record region.
- Signed-out state keeps the same region and presents the login affordance in context.

## Discover / Arthouse visual grammar

- Discover remains the clean discovery/catalog surface.
- Arthouse keeps KINOSIS typography and base palette, but uses restrained archive/editorial cues: thin framing, warmer surface treatment, section index markers and squarer programme/director geometry.
- The distinction is intentionally structural rather than a separate theme or font system.

## Static Preview

- `tools/preview-server.mjs` proxies a bounded allow-list of read-only movie APIs to `KINOSIS_PREVIEW_API_ORIGIN` (default: deployed KINOSIS) so arbitrary movie search/detail works in static Preview.
- Account, cloud, Studio/admin and other mutation APIs remain unavailable in Preview and still require Full/Netlify mode.

## Verification

- `npm test`: required before release packaging.
- `npm run test:browser`: environment-dependent; may SKIP where installed Chromium policy blocks local HTTP origins.
