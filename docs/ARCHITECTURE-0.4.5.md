# KINOSIS 0.4.5 Architecture

## Product boundary

KINOSIS treats **Movie** as the primary object. Different surfaces are projections of that object for different user tasks; they are not separate copies of movie state.

```text
Remote Movie Metadata ─────┐
Availability ──────────────┼──> Movie Entity
                          │
LibraryMembership ────────┤
FilmRelationship ─────────┤
ViewingEvent[] ───────────┤
Collection[] ─────────────┘
```

Ownership such as Blu-ray or digital purchases is deliberately outside the 0.4.5 domain. It must not be inferred from subscription availability.

## Dependency direction

```text
DOM / event delegation (app.js)
          ↓
Feature render policy
  ├─ features/detail.js
  ├─ features/library.js
  └─ ui/movie-card.js
          ↓
Domain selectors/actions
          ↓
Repository / Cloud / API
```

Feature render modules are pure with respect to DOM and network access. `app.js` supplies contextual callbacks and owns orchestration.

## Contextual Movie Card

A single universal card is not a design goal. The entity is shared; the representation is contextual.

- **Discover / Arthouse:** title, year and availability hint. The task is identification/discovery.
- **Library:** current rating, viewing count, subscribed-provider access and Collection membership. The task is retrieval from the current shelf.
- **MY:** viewing count/date and current relationship cues. The task is recalling personal history.

The policy lives in `ui/movie-card.js` so surfaces cannot independently drift into incompatible card semantics.

## Library invariant

`LibraryMembership` means: **the film currently belongs on MY SHELF**. It does not imply watched, rated, favorited or watchlisted.

```text
LibraryMembership != FilmRelationship != ViewingEvent
Collection membership is also independent.
```

Therefore Library IA must keep these concepts distinct:

```text
PERSONAL FILM LIBRARY
├─ COLLECTIONS        # authored organization
└─ MY SHELF           # LibraryMembership
   └─ relationship filters
      ├─ watchlist
      ├─ favorite
      └─ rated
```

Removing LibraryMembership is non-destructive. Full personal-film deletion remains a separate danger command.

## Detail invariant

Detail answers three questions in a fixed order:

1. `ABOUT THE FILM` — stable movie metadata.
2. `WHERE TO WATCH` — volatile availability.
3. `MY FILM` — personal relationship and viewing history.

These correspond to separate partial-render regions. A late availability response may patch `availability` (and small hero availability signals when needed), but it may not replace metadata or personal state.

## Remaining decomposition

`app.js` still owns legacy orchestration for MY, Curation, Cloud and dialogs. New code must not add rendering policy back into that file when an existing feature/domain boundary owns the concern. Recommended extraction order after 0.4.5:

1. `features/my.js`
2. `features/curation.js`
3. account/cloud orchestration adapter
4. shared action controller for delegated events

The objective is dependency clarity, not maximizing file count.
