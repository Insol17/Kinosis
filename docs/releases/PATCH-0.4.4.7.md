# KINOSIS 0.4.4.7 Patch Notes

## Product model

- Personal state schema upgraded to v7: Library membership, current film relationship and individual viewing events are separate concepts.
- Current rating and one-line comment now belong to `FilmRelationship`; rewatch history remains a list of `ViewingEvent`s.
- Legacy 0.4.4.x rating/review/log data is migrated without deleting old viewing history.
- Removing a film from Library removes only Library membership. A separate destructive command removes all personal data for the film.

## Film Detail / performance

- Detail now renders immediately from the movie entity already known by Search/rails/Library instead of waiting for `/api/movie-detail` before the page becomes usable.
- Static metadata, availability and recommendations load concurrently and patch independent Detail regions.
- Availability/recommendation completion no longer re-renders the whole Detail page.
- Search result hover after 120 ms and keyboard focus prefetch the base Detail request.
- Concurrent loader responses merge against the freshest entity, preventing late volatile responses from restoring stale metadata.
- Added client performance marks/measures and server timing visibility.
- `/api/movie-detail` uses a browser cache and a long Netlify durable CDN cache; `/api/movie-availability` uses a shorter volatile cache.

## Rating / one-line comment

- Replaced numeric rating selects with a five-star control supporting 0.5 increments.
- Native radio inputs retain keyboard behavior; pointer hover previews the pending half-star value.
- Detail places the current rating and one-line comment in the primary relationship area rather than burying them in viewing history.
- Viewing dialogs distinguish the current one-line comment from a note that belongs only to that viewing event.

## MY

- Profile counts are actionable drill-down surfaces rather than dead statistics.
- Added a current one-line-comment archive under MY without creating a new global navigation category.
- The review archive can reopen the film or edit its current relationship directly.
- Viewing timeline continues to show each individual watch and historical rating snapshot/note.

## Library

- Library cards/list rows expose a direct remove action.
- Library removal preserves rating, one-line comment, watchlist/favorite, collections and viewing history.
- The destructive all-personal-data action is separated and confirmed independently.
- Sorting/filtering reads membership timestamps and FilmRelationship state from their proper owners.

## Arthouse / Curation

- Arthouse presents Director Archives and Editorial Curations as Collectio-style horizontal programme rails with `전체 보기` drill-down.
- Director Archive and Editorial Curation remain separate data types.
- Added an authored Editorial Curation, `그럼에도 삶은 계속된다`, with introduction paragraphs, chapters and per-film contextual notes.
- Editorial detail is essay/chapter driven; Director Archive detail remains filmography driven.

## Architecture / validation

- Browser critical path uses native ES modules rather than ordered globals for Movie Entity, Store, Router, API Client, Movie Repository, Loader, Search and Detail.
- Added `domain/personal-state.js`, `infrastructure/api-client.js`, `infrastructure/movie-repository.js`, `core/store.js`, `core/router.js` and `core/performance.js`.
- Added JavaScript type checking with `checkJs`; `npm run typecheck` is part of `npm test`.
- Added migration, personal-command, architectural-boundary and loader race/de-duplication regression tests.
- Added an optional zero-dependency Chromium/CDP browser smoke harness for the core Search → Detail → personal-state → Library/MY → Curation flow.
- See `docs/ARCHITECTURE-0.4.4.7.md` for ownership and dependency rules.
