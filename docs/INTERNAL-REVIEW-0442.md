# KINOSIS 0.4.4.2 — Internal design review

## Found and fixed

- The 0.4.4.1 package still referenced `assets/js/recommender.js` in `index.html` even though the client file had been removed. This caused the baseline static regression test to fail and an unnecessary 404 in production. Removed.
- The previous `editorial-0441.css` existed in the package but was not actually linked from `index.html`. The new `design-0442.css` is explicitly linked and regression-tested.
- The brand SVG had an opaque dark rounded-square background. It is now transparent, and all raster icon variants were regenerated with alpha.
- The previous active CSS used many 8–10px labels. The new visual layer raises Korean body/metadata sizes and protects Korean word boundaries.
- Several icon controls relied on black filled backgrounds for contrast. They are now transparent with stroke/drop-shadow/border feedback instead.

## Deliberately unchanged

- Screen layouts and IA.
- Cloud sync/data model.
- KOBIS/TMDB logic.
- Arthouse classifier and file-authored curations.
- Seven-card desktop rail rule.

## Validation targets

- `npm test`
- JS syntax checks
- static visual-layer markers
- curation build validation
- catalog and Netlify Function contract tests
- transparent PNG alpha verification for the brand icons
