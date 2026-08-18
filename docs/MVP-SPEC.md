# KINOSIS 0.4.0 MVP — Product Spec

## Product definition

KINOSIS is a Korean-first film discovery, collection and viewing-history product.

### DISCOVER — “What should I watch?”
- Home
- In Theatres (KR)
- My Streaming
- Streaming
- Top Rated
- cinematic promotional hero with Where to Watch icons, not Library CTA buttons

### LIBRARY — “What have I saved, and how do I find it again?”
- Steam-inspired desktop sidebar
- compact poster shelves
- All Films
- Watchlist
- Favorites
- Manual Collections
- Dynamic Collection: Watchlist × My Streaming
- search / sort / status / rating / genre / decade / My Streaming filters

Library deliberately uses denser, smaller cards than Discover. Discover sells a film visually; Library is a high-volume management surface.

### MY — “What is my history with film?”
- Profile
- Diary
- Reviews
- Ratings
- Calendar
- Stats
- Subscriptions
- Account & Data

Library is content management. MY is autobiographical record/profile.

## Core loop

Discover or Global Search → Save / Log → Watch / Review → Library → Diary / Calendar → Rediscover.

## Global search rule

The weekly Discover cache is **not** the movie database.

Search works in two layers:

1. KINOSIS local/synced movie cache — instant response
2. Netlify Function → TMDB `search/movie` — global result set

Results merge by TMDB movie ID. This allows classics or obscure films that are absent from the current Discover page to be found without pre-downloading the entire TMDB catalog.

## Friction rule

Adding a film must not require a detail-page visit.

Search exposes:

- `+` Save
- `LOG`

A live-search movie is detail-enriched on demand before or while it becomes part of persistent user state.

## Library durability rule

`UserFilm` cannot rely on a movie remaining in the weekly generated `catalog.js`.

For saved/logged films, KINOSIS preserves a normalized movie snapshot keyed by TMDB ID. A future catalog refresh therefore cannot make a user's Library card disappear.

## Streaming model

The user manually identifies subscribed services. KINOSIS does not inspect billing accounts.

A title is shown as available on **MY STREAMING** only if:

- the user marked that provider as subscribed, and
- KR provider data lists that title as subscription/flatrate.

Rent/buy/free/ads are separate offer types.

Collectio is selectable but remains manual-only until verified automatic availability data exists.

## Viewing log model

Each viewing is a separate `ViewingLog`:

- movieId
- watchedAt
- rating optional
- review optional

Rewatches therefore remain distinct in Diary and Calendar.

## Account strategy

0.4.0 remains anonymous/local-first. JSON export/import is the portability guarantee.

Phase 2 can add optional Supabase Auth + RLS. Local records should be merged into the account after explicit user confirmation; cloud state must not silently overwrite local history.

## Mobile strategy

Responsive/PWA remains the source MVP.

Desktop: top navigation + Library sidebar.
Mobile: Discover / Search / Library / My bottom navigation.

No primary mobile interaction may depend on hover.

## Infrastructure split

```text
GitHub
- source control
- CI
- Thursday Discover catalog refresh

Netlify
- production web deployment
- live `/api/*` Functions
- TMDB runtime secret

TMDB / JustWatch
- movie / watch-provider sources
```

## MVP success tests

- Search for a movie absent from Discover (e.g. a classic) and get a TMDB result.
- Search → Save in no more than 2 actions after the result appears.
- Search → Log in no more than 2 actions plus log fields.
- Saved live-search movie survives page reload and weekly catalog changes.
- Watchlist × My Streaming can be identified without opening every detail page.
- Library remains scannable at 100+ films due to compact density, search, sort and collections.
- Multiple watches of one film remain distinct in Calendar/Diary.
- Mobile flow works without hover.
- TMDB/Netlify outage leaves the local catalog searchable.
