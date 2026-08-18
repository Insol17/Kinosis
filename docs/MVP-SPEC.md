# KINOSIS 0.4.1 MVP Specification

## Product loop

```text
DISCOVER / ART MODE
        ↓
GLOBAL SEARCH
        ↓
SIGN IN
        ↓
SAVE / LOG
        ↓
LIBRARY
        ↓
MY (Diary / Reviews / Ratings / Calendar / Stats / Subscriptions)
        ↓
SUPABASE CLOUD SYNC
        ↓
PC ↔ Mobile/PWA
```

## Public vs personal surfaces

### Guest
- DISCOVER
- ART MODE
- global TMDB Search
- film detail / where-to-watch

### Signed in
- everything above
- Save / Log / Watchlist / Favorite / Collections
- LIBRARY
- MY
- OTT preferences
- cross-device sync

The gate is intentional: 0.4.1 treats Library/MY as account-bound personal data rather than a browser-only demo.

## ART MODE

ART MODE changes **content selection**, not the visual theme. Normal and Art share the same KINOSIS interaction grammar.

The classifier emits an internal score and boolean from deterministic metadata features. It is explicitly not an objective measure of artistic quality.

## Data responsibilities

- TMDB: movie identity/metadata/images
- JustWatch via TMDB: KR provider availability
- KINOSIS: personal state and ART MODE classification
- Supabase: Auth + RLS-protected user state
- Netlify: production hosting + TMDB proxy + scheduled Supabase health request
- GitHub Actions: weekly Discover catalog refresh

## Sync model

0.4.1 uses a single per-user JSONB state row as the MVP synchronization boundary. Local signed-in cache is retained for temporary outages. Cloud is loaded on sign-in, local dirty state is retried when connectivity returns, and 0.4.0 local data can be imported once into the authenticated account.
