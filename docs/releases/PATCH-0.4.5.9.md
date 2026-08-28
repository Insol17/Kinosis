# KINOSIS 0.4.5.9

## Arthouse
- Added three authored editorial curations: `결국 가족이다`, `고독한 방황`, `누벨바그 걸작선`.
- `네 멋대로 해라` and `누벨바그 (2025)` are deliberately adjacent in the Nouvelle Vague programme.
- Replaced Director Archive movie rails on the Arthouse index with portrait-first director cards.
- The default Director index shows 25 cards (5 columns × 5 rows on desktop); `전체 보기` expands to grouped regional sections.
- Added a cached director-profile endpoint and representative-feature filmography mode. Existing authored archives remain authoritative; runtime director pages use a compact representative-feature heuristic rather than raw credits.

## Movie Detail
- Strengthened the personal rating panel with an explicit score summary and higher-contrast rating treatment.
- Localized country/language metadata to Korean display names where platform data provides ISO codes.
- Replaced still-image new-tab navigation with an in-page lightbox.
- Fixed the Hero overflow clash by opening the `...` action menu inward/upward, and added long-label overflow safeguards.

## Availability
- Kept TMDB/JustWatch rows as reported candidates rather than verified truth.
- Exposed verification provenance per provider: Collectio official catalogue, timestamped KINOSIS verification, or JustWatch via TMDB.
- Added verification dates and evidence links when the verifier supplies them.
- Preserved separate subscription/rent/buy/free/ads access types and current-theatrical evidence.

## Collections
- Rebuilt Collection cards around four-poster mosaics instead of one backdrop.
- Collection detail now separates browsing from ordering: poster grid first, order editor on demand.
- Added a multi-collection picker so one film can belong to several collections in one operation, with add/remove membership in the same dialog.
