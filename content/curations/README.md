# KINOSIS Curations

`content/curations/*.curation.json` is the Git-authored fallback source for ARTHOUSE programmes. `npm run build` validates definitions, optionally hydrates Director snapshots when a TMDB build token exists, then generates `data/curations.json` + `data/curations.js`.

Admin-only **KINOSIS STUDIO** can publish dynamic overrides. Static files remain the deterministic portfolio-safe fallback.

## `director-archive`

A Director Archive is a filmography surface, not an essay. `personId` is stable identity and `snapshot` is the public content source. Build/Studio refresh updates the snapshot; public Arthouse should not need live filmography assembly.

```json
{
  "slug": "victor-erice",
  "kind": "director-archive",
  "title": "빅토르 에리세",
  "description": "짧은 감독 소개.",
  "source": {
    "type": "director",
    "name": "Víctor Erice",
    "personId": "37833",
    "sort": "release_asc",
    "snapshot": []
  }
}
```

`node scripts/hydrate-director-snapshots.mjs` fills the snapshot with title/year/director/poster/backdrop/overview data when `TMDB_READ_ACCESS_TOKEN` is available. `--if-key` keeps committed snapshots untouched when no build token exists.

## `editorial`

A Curation is a **film collection object**, not a mandatory magazine article. Default schema is title + short description + movies.

```json
{
  "slug": "city-at-night",
  "kind": "editorial",
  "title": "도시를 헤매다",
  "description": "이 영화들을 함께 묶는 짧은 맥락.",
  "orderMode": "unordered",
  "movies": [
    { "id": 123 },
    { "id": 456, "note": "이 작품에만 필요한 선택적 메모." }
  ]
}
```

`orderMode`:

- `unordered`: 영화 묶음. 번호/순서 의미를 강조하지 않음.
- `curated`: 순서 자체가 의미가 있을 때만 번호를 노출.

Film note는 선택 사항입니다. Legacy `chapters`는 읽을 수 있지만 build boundary에서 한 번 평탄화되며 신규 Studio 콘텐츠는 chapter 구조를 만들지 않습니다. Duplicate TMDB movie ids are rejected at build time.
