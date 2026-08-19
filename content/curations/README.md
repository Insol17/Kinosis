# KINOSIS Curations

`content/curations/*.curation.json` is the Git-authored source for ARTHOUSE programmes. `npm run build` validates the definitions and generates `data/curations.json` + `data/curations.js`.

The Arthouse index may render both content types as horizontal programme rails, but their ownership rules are deliberately different.

## `director-archive`

A Director Archive is a filmography surface. It may resolve a director's work automatically and cache that result; it is not editorial selection.

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

`personId` is preferred when known. `mode` can be `all-directed` or `solo-features`; `include` / `exclude` are filmography overrides. Director results are canonicalized by TMDB movie id.

## `editorial`

An Editorial Curation owns its film selection explicitly. A director source is forbidden as its source of truth.

```json
{
  "slug": "city-at-night",
  "kind": "editorial",
  "title": "도시를 헤매다",
  "description": "...",
  "introduction": [
    "첫 번째 편집 문단.",
    "두 번째 편집 문단."
  ],
  "movies": [123, 456, 789]
}
```

For authored progression, use chapters. Chapter/movie notes are rendered on the curation Detail page so the programme explains **why each film is present**, rather than functioning as a plain playlist.

```json
{
  "kind": "editorial",
  "title": "그럼에도 삶은 계속된다",
  "introduction": ["..."],
  "chapters": [
    {
      "title": "아이의 세계",
      "description": "...",
      "movies": [
        { "id": 123, "note": "이 작품이 이 장에 놓인 이유." },
        { "id": 456, "note": "다음 작품으로 이어지는 맥락." }
      ]
    }
  ]
}
```

Movie order is editorial order. Duplicate TMDB movie ids inside one editorial definition are rejected at build time.
