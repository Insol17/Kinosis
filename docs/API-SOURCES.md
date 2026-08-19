# KINOSIS API and attribution policy — 0.4.4.3

## TMDB

TMDB is the canonical external movie source for the MVP: search, detail, credits, imagery, recommendations/similar titles, KR now-playing/upcoming and the Watch Providers bridge.

`TMDB_READ_ACCESS_TOKEN` must exist only in trusted runtimes (Netlify, GitHub Actions or local developer environment). It must never be emitted to the browser.

Required notice remains visible in **Data sources & credits**:

> This product uses the TMDB API but is not endorsed or certified by TMDB.

## JustWatch via TMDB Watch Providers

KINOSIS normalizes provider rows into subscription / free / ads / rent / buy. Client UI then consolidates variants that belong to the same canonical brand so an ad tier does not render as a second Netflix service.

Where to Watch links to the regional provider page returned by TMDB when available. Provider availability is attributed as **JustWatch via TMDB** and is treated as advisory rather than a transaction guarantee.

### Provider marks

Availability remains sourced from TMDB/JustWatch, but KINOSIS normalizes provider brand identity in `data/providers.js`. Provider tiers that represent the same brand are consolidated before rendering.

WATCHA is the explicit presentation exception: KINOSIS uses the official transparent WATCHA wordmark stored in `assets/branding/providers/watcha-logo-white.png` instead of the current upstream provider tile. This does not change availability data; it only corrects the displayed brand asset.

## KOBIS — exact Korean box office

`/api/box-office` reads the previous Korean calendar day's KOBIS daily box-office ranking when `KOBIS_API_KEY` is configured, then matches those rows to TMDB IDs for KINOSIS posters/detail navigation.

Important rule: TMDB popularity is never relabeled as a box-office ranking. If KOBIS cannot be used reliably, Discover renders an unranked `현재 상영작` shelf instead.

The scheduled catalog updater follows the same rule. `KOBIS_API_KEY` can be supplied in GitHub Actions so generated catalog data also carries exact ranks.

## Theatrical state

TMDB `now_playing`, KOBIS live box-office rows and KR theatrical release-date records can all mark a film as theatrically current. Film detail therefore can show `극장 · 현재 상영 중` even when there are no OTT providers.

This logic is data-driven; individual movie titles are not hardcoded.

## Failure policy

- Catalog refresh: fetch → enrich → validate → replace; failure leaves last known-good data intact.
- Exact box office: if KOBIS is missing/fails, remove ranking semantics rather than fabricate rank numbers.
- Live search/detail: preserve local catalog results where possible and report remote failure.
- Saved movie durability: personal state stores a normalized movie snapshot keyed by TMDB ID so Library entries do not depend on remaining in the current weekly Discover catalog.

## 0.4.4.4 theatrical semantics

- `박스오피스`: KOBIS daily ranking when configured. TMDB popularity is never labeled as a rank.
- `공개 예정작`: TMDB Discover, `region=KR`, theatrical release types `3|2`, next 120 days. A cached `/api/upcoming` endpoint fills a thin weekly snapshot at runtime.
- `상영 중`: requires current evidence such as KOBIS/current catalog or TMDB KR now-playing. A recent theatrical release date alone is labeled `최근 극장 개봉`, not `상영 중`.
