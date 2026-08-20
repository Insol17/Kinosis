# KINOSIS 0.4.5.2 Architecture Notes

## Product boundary

KINOSIS remains a Personal Film Library. Public surfaces have distinct jobs:

```text
DISCOVER   broad discovery
ARTHOUSE   authored/contextual discovery
DETAIL     one Movie Entity + availability + personal actions/history
LIBRARY    current shelf + separate watchlist + Collections
PROFILE    the user's film-life archive and account settings
```

The internal route key `my` is retained only for backward compatibility. It is not a second public concept.

## Personal state v8

```text
Movie external metadata
        │
        ├── LibraryMembership   current shelf
        ├── FilmRelationship    current rating/comment/watchlist/favorite
        ├── ViewingEvent[]      historical viewing snapshots/notes
        └── Collection[]        user-authored organization
```

### Shelf invariant

Watchlist alone does not imply current shelf membership. Authored/current engagement does:

- current rating,
- current one-line comment,
- favorite,
- a new ViewingEvent,
- Collection membership.

Migration from older schemas performs this promotion once. Normalizing an already-v8 state must not regenerate a membership the user deliberately removed.

### Historical integrity invariant

A historical ViewingEvent owns `ratingSnapshot` and `note`. Editing a historical event must not mutate the current FilmRelationship. A new viewing may update the current rating, because it is a new present-tense opinion.

## Movie Entity enrichment

Movie responses arrive with different completeness levels. Omission is not deletion.

`core/movie-entities.merge()` preserves existing enriched fields when a lightweight response does not own them, including:

- providers,
- cast,
- genres,
- keywords,
- production companies,
- director / directorId,
- runtime,
- overview,
- poster/backdrop/release metadata.

Explicit new values may replace old values; absent fields do not erase known data.

## Arthouse pipeline

Arthouse is programme-first, not classifier-first.

```text
content/curations/*.curation.json
          │
          ├── Editorial Curation
          └── Director Archive
                 │
                 ├── stable personId
                 ├── build snapshot
                 └── runtime live enrichment

programme state
idle → loading → ready / empty / error
                   ↑            │
                   └── retry ───┘
```

Snapshots render immediately. Live API success enriches/replaces them. Live failure preserves the snapshot and exposes error/retry state; it is never cached as a successful empty archive.

The Arthouse Hero uses one unique representative per programme and routes curation slides to Curation Detail.

## Discover allocation

`features/discovery.js` owns discovery selection policy rather than DOM rendering.

1. Hero rotates through independent sources instead of taking one popularity slice.
2. An Editorial curation may occupy a Hero slot.
3. Visible Hero movie IDs are excluded from the next visible rails.
4. Box Office → Upcoming → subscription → high-rated rows allocate from a shared used-ID set.
5. High-rated rows use confidence-weighted ranking.

This policy is intentionally about the first visible inventory; it does not permanently remove a film from all discovery contexts.

## Search task continuity

Search is a task context, not a disposable modal.

```text
query/results
   ↓
open film
   ↓  search dialog closes but controller state remains
Detail
   ↓ back
search query/results restored
```

The listbox option contains one main option control. Auxiliary personal actions are sibling controls to avoid nested interactive semantics.

## Demo isolation

Demo mode is a local session state, not authentication.

```text
Demo seed → local state → normal renderers
                    X Cloud read/write
```

`hasCloudAccount()` is the gate for Cloud operations. A real authenticated user exits demo mode; a null auth callback does not wipe an active demo session.

## Current module boundary

```text
core/
  store.js
  router.js
  performance.js
  movie-entities.js

domain/
  personal-state.js
  personal-actions.js
  demo-state.js

infrastructure/
  api-client.js
  movie-repository.js

services/
  movie-loader.js

features/
  search.js
  detail.js
  library.js
  arthouse.js
  discovery.js

ui/
  movie-card.js

app.js
  composition, legacy surface rendering and event delegation
```

`app.js` is still the largest remaining architectural debt. 0.4.5.2 avoids a high-risk wholesale rewrite during a stability release. Future extraction should move Profile and Curation presentation/orchestration out incrementally while keeping domain/service modules DOM-agnostic.

## Editorial Studio boundary

A future Studio remains a separate Editorial domain with server-authorized writes and Draft/Published/Archived lifecycle. It is deliberately excluded from 0.4.5.2 because reviewer-facing product reliability has priority.
