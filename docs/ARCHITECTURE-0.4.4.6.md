# KINOSIS 0.4.4.6 Architecture

0.4.4.6 treats movie metadata as an entity cache and personal activity as durable user state. A personal record must remain visible even when the corresponding TMDB entity is not currently hydrated.

## Layer map

```text
UI / feature rendering
  assets/js/features/search.js
  assets/js/features/detail.js
  app.js (Library / MY / routing; remaining decomposition target)
                │
                ▼
Domain
  assets/js/core/movie-entities.js
  - canonical movie normalization
  - personal movie-id discovery
  - missing-entity placeholder contract
  - compact cloud snapshot contract
                │
                ▼
Application services
  assets/js/services/movie-loader.js
  - detail request orchestration
  - availability request orchestration
  - personal summary hydration
  - in-flight request de-duplication
                │
                ▼
Netlify Functions
  /api/movie-detail       static film metadata + credits
  /api/movie-availability volatile providers / KR theatrical status
  /api/movie-summaries    batch hydration for Library / MY
  /api/movie-search       search results
                │
                ▼
TMDB / KOBIS / Supabase
```

## Movie entity model

KINOSIS has three different kinds of state and they must not be conflated.

### 1. Durable personal relationship state

`state.library`, `state.logs`, and `state.collections` are the source of truth for the user's film life. They reference canonical TMDB movie IDs.

These records must render even when metadata is unavailable.

### 2. Replaceable movie entity metadata

`movieMap` is the current runtime entity cache. `state.movieCache` contains only metadata worth persisting for personal movies.

Cloud Sync sends a compact snapshot only for movie IDs referenced by Library, Logs, or Collections. The snapshot contains retrieval-critical fields such as title, year and poster URL, but does **not** contain volatile OTT availability.

### 3. Volatile availability

OTT providers and theatrical state are refreshed separately. They are not allowed to block the base movie page and are not treated as durable cloud state.

## Critical user flows

### Search → Detail

```text
Search result selected
  → switch route to movie immediately
  → render visible loading shell immediately
  → /api/movie-detail
       one upstream TMDB detail request with appended credits
  → render usable movie page
  → in background:
       /api/movie-availability
       /api/movie-recommendations
  → patch only those sections when each request completes
```

The user never waits for watch-provider or now-playing verification before seeing the film page.

### Login / Cloud → Library and MY

```text
Cloud payload arrives
  → personal IDs + compact snapshots are restored
  → Library / MY render immediately
  → missing IDs render explicit loading placeholders
  → /api/movie-summaries hydrates missing entities in batches
  → Library / MY rerender with title/poster metadata
```

A missing movie entity can degrade visually, but it cannot make a saved film or viewing log disappear.

## Runtime contracts

1. TMDB movie ID is the canonical identity when present.
2. Personal records are never filtered out because movie metadata is missing.
3. Missing metadata renders an explicit placeholder/loading state.
4. Static detail rendering does not depend on provider/theatrical requests.
5. Detail, availability and summary requests are de-duplicated while in flight.
6. Detail rendering must not throw because a dependency was supplied as a boolean instead of a callback; the current call site passes the callback and the feature has a defensive contract.
7. Cloud movie snapshots contain stable metadata only; availability is separately hydrated.
8. Inline image event handlers are not used because the production CSP blocks them.

## Why app.js still exists

`app.js` remains the composition root and currently still owns routing, user-state mutation, Library/MY rendering, dialogs and event delegation. Moving all of that at once in a reliability patch would increase regression risk.

The next safe decomposition order is:

```text
core/state-store.js
core/router.js
features/library.js
features/my.js
features/curation.js
```

Each extraction should first receive a contract test, then move one responsibility without changing UX. A framework migration is not justified yet; the current failure mode was ownership/contract ambiguity, not lack of a framework.
