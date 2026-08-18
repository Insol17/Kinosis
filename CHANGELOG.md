# Changelog

## 0.3.0
- Website polish pass based on direct product review.
- SVG navigation/icon system; removed font-dependent navigation glyphs.
- Actionable empty states and clearer instant search messaging.
- MY → Account & Data surface with truthful local/cloud status.
- Local-data backup reminder and last-export timestamp.
- Narrow-screen Library grid/touch-target refinements.
- Accessibility skip link and icon semantics.
- Zero-dependency smoke tests + GitHub Actions CI.
- CONTRIBUTING, license status, and account migration documentation.

## 0.3.1 — Banner / imagery / OTT polish

- Reworked Discover hero into a wide promotional banner instead of a large action card.
- Removed Library / Log / Detail CTA buttons from the hero.
- Added `WHERE TO WATCH` provider logo tiles using TMDB Watch Provider logo URLs.
- Fixed Korean title wrapping with `word-break: keep-all` and length-aware title sizing.
- Added TMDB movie `images` lookup for likely hero candidates, choosing a high-quality 16:9 backdrop and Korean/English title logo when available.
- Added `tagline`, `heroBackdropUrl`, and `logoUrl` fields to generated live catalog entries.
- Fixed the poster fallback layer incorrectly covering successfully loaded poster images.
- Added Collectio (콜렉티오) to user-manageable OTT subscriptions. Collectio availability is not auto-matched because it is not currently present in the TMDB/JustWatch KR provider data verified for this build.
- Added provider-name aliases (`Watcha`/`WATCHA`, `Disney Plus`/`Disney+`, etc.) so My Streaming matching is less brittle.
- Updated GitHub Actions to checkout/setup-node v5 with Node 24.
