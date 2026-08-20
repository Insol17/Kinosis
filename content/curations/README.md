# KINOSIS Curations

`content/curations/*.curation.json` is the Git-authored fallback source for ARTHOUSE programmes. `npm run build` validates the definitions and generates `data/curations.json` + `data/curations.js`.

0.4.5.3 adds the admin-only **KINOSIS STUDIO**. Published Studio rows override a static programme with the same slug; if the optional Studio table is unavailable, these files remain the complete portfolio-safe fallback.

## `director-archive`

A Director Archive is a filmography surface, not an essay. `personId` + a checked snapshot are the content source; live TMDB refresh is enrichment and is skipped while the snapshot is fresh.

```json
{
  "slug": "victor-erice",
  "kind": "director-archive",
  "title": "빅토르 에리세",
  "source": {
    "type": "director",
    "name": "Víctor Erice",
    "personId": "37833",
    "sort": "release_asc",
    "snapshot": []
  }
}
```

## `editorial`

An Editorial Curation owns an explicit ordered film list. The default public grammar is intentionally light: **short introduction + ordered films + short note per film**. Chapters are accepted only for backward compatibility and are flattened by the 0.4.5.3 renderer; new Studio content does not create them.

```json
{
  "slug": "city-at-night",
  "kind": "editorial",
  "title": "도시를 헤매다",
  "description": "...",
  "introduction": ["짧은 서문."],
  "movies": [
    { "id": 123, "note": "첫 번째로 두는 이유." },
    { "id": 456, "note": "다음 영화로 이어지는 맥락." }
  ]
}
```

Movie order is editorial order. Duplicate TMDB movie ids are rejected at build time.
