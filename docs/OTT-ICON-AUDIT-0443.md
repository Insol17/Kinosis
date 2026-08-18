# OTT icon audit — 0.4.4.3

Current catalog provider names observed before normalization:

- wavve
- Google Play Movies
- Netflix
- Netflix Standard with Ads
- Disney Plus
- Watcha
- Amazon Prime Video
- TVING

## Canonical presentation

| Upstream name | KINOSIS brand | Asset policy |
|---|---|---|
| Netflix / Netflix Standard with Ads | Netflix | One consolidated brand; TMDB logo |
| Disney Plus / Disney+ | Disney+ | TMDB logo |
| Watcha / WATCHA | WATCHA | Official WATCHA transparent wordmark override |
| wavve / Wavve | Wavve | TMDB logo |
| TVING | TVING | TMDB logo |
| Amazon Prime Video / Prime Video | Prime Video | TMDB logo |
| Google Play Movies | Google Play | TMDB logo |
| Apple TV Plus / Apple TV+ | Apple TV+ | TMDB logo when present |

Apple TV (store/rent/buy) is intentionally **not** canonicalized to Apple TV+. The provider normalizer preserves `+` as `plus` so the two services do not collapse into one brand accidentally.

Provider artwork is never given a KINOSIS black square/tile. Image marks use transparent containers and `object-fit: contain`. When no usable logo exists, the UI falls back to a short text mark rather than inventing a logo.
