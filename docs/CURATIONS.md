# KINOSIS 0.4.4.5 — Curation architecture

```text
content/curations/*.curation.json
        ↓ npm run build
data/curations.json + data/curations.js
        ↓
ARTHOUSE collection-card index
        ↓
?curation=<slug>
```

KINOSIS now treats **Director Archive** and **Editorial Curation** as different domain objects.

## Director Archive

`kind: "director-archive"` may use `source.type: "director"`. The resolver can use a TMDB person id/name, sorting, `all-directed` / `solo-features`, and explicit include/exclude overrides. It is a filmography utility, not authored editorial membership.

## Editorial Curation

`kind: "editorial"` must own explicit TMDB movie ids through `movies` or `chapters`. The build rejects an editorial definition that delegates membership to a director auto-source. This makes thematic programs such as cities, weather, eras or relationships possible without changing application logic.

## Identity

TMDB movie id is the canonical key wherever it exists. Title/year identity is reserved for external records that have no TMDB id; two distinct TMDB ids are never collapsed just because their title/year match.

## Publishing

Publishing remains a Git operation. `npm run build` validates slug, kind, source contract, ids, duplicate editorial membership and field lengths. Keep content commits independent from application code when practical.
