# KINOSIS 0.4.4.7 Architecture

0.4.4.7 establishes explicit boundaries around the parts of KINOSIS that change at different rates. The objective is not to introduce a framework; it is to prevent UI, personal film state, remote movie metadata and cloud persistence from becoming one mutable graph.

## Dependency direction

```text
Browser entry / composition (`app.js`)
        |
        +--> feature views/controllers
        |       Search / Detail / Library / MY / Curation
        |
        +--> services
        |       request orchestration / hydration / sync coordination
        |
        +--> infrastructure
        |       API client / repositories
        |
        +--> Netlify APIs / Supabase

Domain modules
Movie identity / Personal state / Viewing semantics
        ^
        |
No DOM, no fetch, no router dependency
```

New modules must not reverse this direction. In particular, domain code cannot import a view, access `document`, or call `fetch`.

## Personal film model — schema v7

Three concepts are deliberately separate.

### LibraryMembership

```text
movieId
savedAt
updatedAt
```

This only answers: **is this film in my Library?** Removing membership must not erase anything else.

### FilmRelationship

```text
movieId (map key)
rating          0.5 ... 5.0 | null
comment         current one-line comment
watchlist
favorite
updatedAt
```

This is the user's current relationship with one film. Rating and one-line comment are singular current values rather than attributes copied into every watch event.

### ViewingEvent

```text
id
movieId
watchedAt
rewatch
ratingSnapshot  optional historical snapshot
note            note for this viewing only
createdAt
updatedAt
```

A film can have any number of viewing events. Removing a film from Library does not remove these events.

## Migration invariant

`domain/personal-state.js` migrates 0.4.4.x data into schema v7.

- legacy `library.rating` -> `relationships[movieId].rating`
- legacy `library.review` -> `relationships[movieId].comment`
- legacy log rating -> `ViewingEvent.ratingSnapshot`
- legacy log review -> `ViewingEvent.note`
- membership retains only membership timestamps

Existing data is preserved; migration is idempotent through state normalization.

## Movie entity ownership

TMDB movie id is the canonical identity when available. A movie entity is external metadata, not the user's personal state.

```text
MovieEntity            stable-ish external metadata
FilmRelationship       durable personal state
LibraryMembership      durable personal state
ViewingEvent           durable personal state
Availability           volatile remote state
```

Compact cloud snapshots can contain stable entity metadata required to identify a saved film. Provider/theatrical availability is excluded from personal cloud snapshots and refreshed separately.

## Detail critical path

0.4.4.7 removes the previous "wait for detail before a film page looks like a film page" behavior.

```text
Search / rail movie entity
        |
        +--> route immediately
        +--> render usable Detail from known entity
                 |
                 +--> movie-detail --------> patch hero / metadata / activity
                 +--> movie-availability --> patch availability / hero only
                 +--> recommendations -----> patch related only
```

No secondary request is allowed to replace the entire Detail DOM. Async results merge against the freshest MovieEntity, preventing a late availability response from restoring an older placeholder.

Search result hover (120 ms) and keyboard focus may prefetch the base Detail resource. Prefetch is intentionally bounded to interaction intent rather than every search result.

## Cache ownership

Static and volatile resources use different policies.

- `/api/movie-detail`: browser cache + Netlify durable CDN cache; long static horizon.
- `/api/movie-availability`: shorter browser/CDN horizon.
- Search remains short-lived.
- Client API requests do not force `no-store`.

`Server-Timing` is emitted by Detail/Availability so production latency can be separated into network/cache/upstream work. Client diagnostics are available through `window.__KINOSIS_PERF__.snapshot()`.

## Browser module boundary

The critical path now uses native ES modules with explicit imports:

```text
core/
  store.js
  router.js
  performance.js
  movie-entities.js

domain/
  personal-state.js

infrastructure/
  api-client.js
  movie-repository.js

services/
  movie-loader.js

features/
  search.js
  detail.js
```

The remaining legacy UI helpers are still loaded as globals while they are migrated incrementally. New critical-path code must not add another ordered `window.KINOSIS_*` dependency.

`jsconfig.json` enables JavaScript type checking (`allowJs + checkJs + noEmit`). `npm run typecheck` is part of the release test command. This is intentionally lighter than a TypeScript rewrite while still catching interface mismatches such as boolean-vs-function dependencies.

## View mutation rule

New feature/domain code must not mutate persistence state from a rendering function. The intended flow is:

```text
UI event
 -> command/controller
 -> domain/store mutation
 -> persistence/sync
 -> targeted view patch
```

0.4.4.7 applies this strictly to the new personal-state and Detail paths. `app.js` still contains older surface orchestration; it is not considered a completed decomposition.

## Curation hierarchy

Two content types remain separate at the domain level even though Arthouse presents both as horizontal rails.

```text
Director Archive
  source: director filmography
  detail: director context + filmography

Editorial Curation
  source: explicit TMDB movie ids / authored chapters
  detail: introduction + chapter essays + per-film notes
```

A director resolver may assist an archive; it cannot become the source of truth for an Editorial Curation.

## Destructive action hierarchy

`라이브러리에서 제거` is non-destructive outside membership.

```text
Remove from Library
  -> delete LibraryMembership only

Delete all personal film data
  -> LibraryMembership
  -> FilmRelationship
  -> all ViewingEvents
  -> collection links
```

The latter is deliberately hidden behind a separate destructive confirmation.


## Browser regression harness

`npm run test:browser` starts an isolated local fixture server, mocks the external movie/cloud boundaries, launches installed Chromium through the DevTools Protocol and exercises the critical user flow. It intentionally avoids coupling production code to a test framework. If enterprise Chromium policy blocks local HTTP origins, the harness exits as an explicit `SKIP`; unit/runtime contracts remain the portable release gate.

## Next extraction order

The current release establishes real boundaries but `app.js` still owns substantial composition and older screens. Continue extraction in this order rather than adding new cross-cutting globals:

1. Library controller/view/selectors
2. MY controller and archive views
3. Curation index/detail controller
4. Cloud repository adapter behind the store
5. Remove remaining ordered global-script dependencies

The release rule is: **do not make `app.js` the implementation location for a new feature if an existing domain/service/feature boundary can own it.**
