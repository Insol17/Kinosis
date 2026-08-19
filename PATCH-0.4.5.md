# KINOSIS 0.4.5 Patch Notes

## Identity
KINOSIS is defined as a **Personal Film Library**: a place where external movie metadata, current availability, the user's present relationship and viewing history meet around one Movie Entity. The user-facing shorthand is **나만의 영화장**.

This release intentionally does **not** add Blu-ray, physical ownership or digital-purchase tracking. `Where to Watch` remains grounded in the current Korea-first subscription/theatrical data already supported by KINOSIS.

## Library
- Library is the present-tense shelf (`LibraryMembership`), not an alias for all watched/rated/watchlisted movies.
- `Watchlist`, `Favorite` and `Rated` are relationship filters inside the shelf.
- Collections are a separate user-authored organization layer.
- Contextual Library cards show the information relevant to retrieval: personal rating, viewing count, subscribed-provider access and Collection membership.
- Removing a film from the shelf is non-destructive. Personal history and relationships remain available in MY/Detail.

## Detail
Detail is now organized around three questions:

1. **이 영화는 무엇인가?** — synopsis, director, cast and facts.
2. **지금 어디서 볼 수 있는가?** — current Korea-first theatre/OTT availability and the user's subscribed providers.
3. **나와 어떤 관계인가?** — Library state, current rating/comment, watchlist/favorite, Collections and viewing events.

The hero retains the user's star rating/one-line comment and makes `내 영화장에 담기` a first-class action.

## Architecture
```text
Movie Entity
   │
   ├─ Discover/Arthouse card → identification context
   ├─ Library card           → current relationship/retrieval context
   └─ MY card                → viewing/history context

Library View
   ↓
features/library.js
   ↓
context callbacks supplied by app.js

Movie Card
   ↓
ui/movie-card.js
```

Feature renderers do not fetch or mutate persistence directly. Domain state remains separated as LibraryMembership / FilmRelationship / ViewingEvent.

## Validation
`npm test` covers build, checkJs, syntax, static product contracts, API contracts, curation/provider/state integrity, schema v7, Library contextual behavior, architecture boundaries and runtime Detail/loader races.
