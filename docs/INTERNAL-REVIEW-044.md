# KINOSIS 0.4.4 — Internal review

## Fixed during review

- Hero autoplay originally only started for the view that happened to be active during `renderAll()`. Navigation now re-arms the active hero and stops the hidden one.
- The 0.4.3 cloud path was effectively pull-on-login + later push. Added foreground pull and remote-before-push merge.
- Successful pushes used to upload a payload whose `dirtySince` was still set. 0.4.4 serializes a clean cloud payload before writing.
- Viewing-log deletion had no distributed delete marker. Added deletion tombstones.
- Subscription arrays lacked their own conflict timestamp. Added `subscriptionsUpdatedAt`.
- Profile conflicts previously depended on the whole-state modified timestamp. Profile now carries its own `updatedAt`.
- Arthouse used a special compact poster size, which made Discover and Arthouse feel like different products. Both now use the same seven-card poster grammar.
- Library Home duplicated MY/Discover behavior with stats, recent rows and recommendation-like shelves. It is removed; Library now opens to management directly.
- A `박스오피스` label without actual Korean box-office data would be misleading. Exact ranking is optional via KOBIS; fallback is labeled `극장 인기 순위`.

## Deliberately not added

- No Admin/Curation database. Git remains the editorial CMS.
- No push notifications yet. Availability-change detection remains the prerequisite layer.
- No new social surface.
- No AI recommender expansion in this patch; 0.4.4 is primarily navigation, browsing density and sync reliability.

## Validation

`npm test` checks syntax, static UX markers, catalog integrity, Netlify function contracts, Arthouse classification and the four generated curations. The package is also ZIP-integrity tested before handoff.
