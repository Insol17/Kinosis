# KINOSIS 0.4.6.1

## Arthouse

- Removed the large in-page `CURATION / DIRECTOR'S ARCHIVE` switcher requested for removal.
- Desktop ARTHOUSE hover navigation still provides direct category access.
- Overview content remains the mobile/touch path: each Curation and Director preview exposes its own full-index action.

## Collections

- Replaced the previous collection index emphasis on decorative cards with a quieter personal-list hierarchy: cover mosaic, title, work count, description and modified date.
- Simplified collection detail around title/description, work count, the film grid and an optional ordering editor.
- Added a collection-local search controller (`features/collection-search.js`). Users can type, see local results immediately, receive live results after the short debounce, add a film, and continue searching without leaving or reopening the collection.
- Already included films are rendered as `추가됨` and cannot be duplicated.

## Search / performance

- Added `features/movie-search-index.js`. Movie title, original title, director, genres and cast are normalized once when the search surface is created instead of on every keypress.
- Search controllers now include locally known/saved movie entities in the initial in-memory index.
- Live debounce is 120 ms and Korean IME composition is respected. Stale live requests continue to be aborted/ignored.
- `movie-repository.js` caches normalized query results for five minutes (maximum 60 entries), so reopening or repeating the same search does not immediately hit the network again.
- `movie-search.mjs` uses TMDB `/search/multi` for ordinary title/person lookup instead of calling `/search/movie` and `/search/person` separately. A second `/discover/movie` request is made only when the query exactly matches a supported genre token.
- Poster thumbnails use lazy decoding/loading on search result surfaces.

## Structure

- Collection-local search behavior is isolated from collection persistence and presentation.
- Historical PATCH/AUDIT files remain under `docs/releases/` and `docs/audits/`; duplicate copies were removed from repository root.

## Verification

- `npm test` covers build, TypeScript checkJs, static contracts, Netlify Functions, personal state, collections, search performance, Arthouse, architecture, runtime contracts, Studio/performance, calendar and theatrical snapshots.
