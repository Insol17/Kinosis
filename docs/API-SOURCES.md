# API and attribution policy

## Active in 0.2

### TMDB
Used for movie metadata, release information, ratings, poster/backdrop paths, credits, and the KR `now_playing` list.

Required product notice is shown inside **Data sources & credits**:

> This product uses the TMDB API but is not endorsed or certified by TMDB.

The API token belongs only in GitHub Actions Secrets / local shell environment. It must never be embedded in `index.html`, `catalog.js`, or browser JavaScript.

### JustWatch via TMDB Watch Providers
Used for KR availability grouped into subscription, free, ads, rent, and buy. The UI labels the source near provider information and in the credits surface.

The provider endpoint does not prove a user's entitlement and does not guarantee final price or availability at the moment of purchase. The app therefore says "내 구독에서 제공됨" only after intersecting provider availability with the user's manually selected subscriptions.

## Not active yet

### KOBIS
Candidate for Korean box-office / theatrical validation. Do not merge it into the production sync until its API key, exact endpoint contract, update cadence, and attribution/use conditions have been verified for the intended deployment.

### KMDb
Candidate for deeper Korean film archival metadata. It is intentionally kept as a separate future adapter rather than silently mixing identifiers into TMDB records.

## Failure policy

The scheduled updater follows fetch → enrich → validate → replace. Any failed fetch or failed minimum-data validation aborts before replacing the last known-good catalog. The frontend can always fall back to the existing generated `catalog.js`.
