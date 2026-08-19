# KINOSIS 0.4.5.1 Architecture Notes

## Public product boundary

KINOSIS remains a Personal Film Library. 0.4.5.1 tightens the distinction between four public concerns:

- **Discover / Arthouse** — discovery surfaces.
- **Detail** — film facts, current availability and personal actions/history.
- **Library** — present-tense shelf membership plus a separate watchlist destination.
- **Profile** — viewing history, comments, statistics and settings.

The legacy route key `my` is retained only to avoid route/state migration churn. It is not a second user-facing product concept.

## Personal-film invariants

```text
LibraryMembership != FilmRelationship != ViewingEvent
```

- Watchlist is FilmRelationship state and does not implicitly create LibraryMembership.
- `Library > 전체 영화` is sourced only from LibraryMembership.
- `Library > 보고싶어요` is sourced from FilmRelationship.watchlist.
- Removing LibraryMembership does not remove watchlist, rating, comment or viewing events.

## Movie entity merge invariant

A lightweight movie response may omit enriched fields. Omission is not deletion.

`core/movie-entities.merge()` therefore preserves existing `providers`, `cast`, `genres`, `keywords` and `productionCompanies` when the incoming object does not own those properties. This prevents progressive availability/detail responses from causing visual provider regressions.

## Arthouse source invariant

Generic Arthouse ranking is not the source of truth for programmed content.

```text
Director Archive / Editorial hydration
          +
static art candidates
          -> Arthouse source pool
```

Curated/programmed movies are admitted explicitly. The heuristic classifier is only used for unprogrammed candidates, and a broad director seed alone is insufficient.

## Detail copy boundary

The three design questions remain internal IA heuristics, not interface copy. The user-facing sections are:

```text
작품 정보
감상 가능
내 기록
```

Internal domain names such as `FilmRelationship` must not leak into headings.

## Editorial Studio

A future Studio should live in a separate editorial domain and server-authorized write path. It is intentionally not part of 0.4.5.1; adding an internal CMS before the public surfaces are stable would increase scope without improving the portfolio reviewer's primary flow.
