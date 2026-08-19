# KINOSIS Curations

`content/curations/*.curation.json` is the Git-authored source for ARTHOUSE collection cards. `npm run build` validates the definitions and generates `data/curations.json` + `data/curations.js`.

## Two different content types

### `director-archive`

A Director Archive is an automatically resolved filmography surface. It is not an editorial curation.

```json
{
  "slug": "victor-erice",
  "kind": "director-archive",
  "title": "빅토르 에리세",
  "subtitle": "Víctor Erice",
  "source": {
    "type": "director",
    "name": "Víctor Erice",
    "sort": "release_asc",
    "mode": "solo-features"
  }
}
```

`personId` is preferred when known. `mode` can be `all-directed` or `solo-features`; `include` / `exclude` are filmography overrides. Director results are canonicalized by TMDB movie id. They are resolved only when the archive is opened and then cached.

### `editorial`

An Editorial Curation owns its movie selection explicitly. A director source is forbidden as its source of truth.

```json
{
  "slug": "city-at-night",
  "kind": "editorial",
  "title": "도시를 헤매다",
  "description": "...",
  "movies": [123, 456, 789]
}
```

For an authored sequence, use chapters:

```json
{
  "kind": "editorial",
  "title": "그럼에도 삶은 계속된다",
  "chapters": [
    { "title": "01. 소년과 세계", "movies": [123, 456] },
    { "title": "02. 현실과 영화", "movies": [789] }
  ]
}
```

Movie array order is editorial order. Duplicate TMDB movie ids across an editorial definition are rejected at build time.
