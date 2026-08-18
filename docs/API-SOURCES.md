# KINOSIS API and attribution policy — 0.4.0

## TMDB: active

TMDB is the canonical external movie source for the MVP.

Used for:

- movie search
- titles / original titles / release dates
- overview / runtime / genres
- director via credits
- TMDB rating
- poster / backdrop / title artwork for the generated Discover catalog
- IMDb external ID
- KR now-playing / trending / streaming / top-rated Discover cache

Required product notice is visible inside **Data sources & credits**:

> This product uses the TMDB API but is not endorsed or certified by TMDB.

### Secret handling

`TMDB_READ_ACCESS_TOKEN` must exist only in trusted runtimes:

- GitHub Actions Secret for scheduled catalog generation
- Netlify Environment Variable for live serverless search/detail
- local shell/Netlify CLI for development

Never place it in `index.html`, `catalog.js`, frontend JavaScript, commits, screenshots or documentation examples containing the actual value.

## Netlify Functions: active in 0.4.0

Frontend browser requests:

```text
/api/movie-search?q=...
/api/movie-detail?id=...
```

Netlify Functions then call TMDB using the server-side environment variable. Search results are normalized before being returned to the browser; the token is never returned.

`movie-search` is short CDN-cacheable. `movie-detail` is longer CDN-cacheable. The PWA service worker explicitly does not intercept `/api/*`.

## JustWatch via TMDB Watch Providers: active

TMDB Watch Providers supplies KR availability originating from JustWatch.

KINOSIS groups offers into:

- subscription
- free
- ads
- rent
- buy

Provider information is attributed as **JustWatch via TMDB** near relevant UI and in credits.

The data does not prove a user's entitlement and is not guaranteed to represent final price/availability at the instant of purchase. KINOSIS therefore says a title is on **MY STREAMING** only after intersecting KR subscription/flatrate availability with subscriptions manually selected by the user.

## Collectio: manual subscription only

Collectio is available as a user preference in `MY → SUBSCRIPTIONS`.

KINOSIS does not scrape Collectio and does not automatically claim that a specific title is available there until a stable and permitted data integration is verified.

## KOBIS: planned adapter, inactive

Candidate for Korean theatrical / box-office validation. Keep separate from TMDB identifiers and verify API terms before activating.

## KMDb: planned adapter, inactive

Candidate for deeper Korean film archival metadata. Keep as an independent adapter rather than silently merging identifiers into TMDB records.

## Failure policy

### Scheduled Discover refresh

fetch → enrich → validate → replace. Failure aborts before replacing the last known-good catalog.

### Live Search

local KINOSIS search renders first. If the Netlify/TMDB request fails, the search UI explicitly reports that global search is unavailable while preserving local results.

### Saved movie durability

A Library item must not depend on remaining in the current weekly Discover catalog. When a movie is saved/logged/watchlisted/favorited, KINOSIS stores a normalized movie snapshot in local state keyed by TMDB ID.
