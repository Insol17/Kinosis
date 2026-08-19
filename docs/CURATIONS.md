# KINOSIS 0.4.4.4 — Curation architecture

Curation is an ARTHOUSE-only editorial feature. Git is the current CMS for the one-editor workflow.

```text
content/curations/*.curation.json
        ↓
npm run build
        ↓
data/curations.json + data/curations.js
        ↓
ARTHOUSE
        ↓
?curation=<slug>
```

Director definitions resolve only when opened. Results are deduplicated by id and original-title/year identity before rendering.

## Director modes

```json
{
  "source": {
    "type": "director",
    "name": "Víctor Erice",
    "sort": "release_asc",
    "mode": "solo-features"
  }
}
```

- `all-directed`: all unique movie directing credits.
- `solo-features`: feature-length (>=60m), sole-director films only.
- `personId`: optional canonical TMDB person id.
- `include` / `exclude`: explicit TMDB movie-id overrides.

The Víctor Erice definition uses `solo-features` so shorts, anthology/co-directed work and duplicate upstream credits do not inflate the collection.

Static `movies: [TMDB_ID, ...]` remains supported for hand-edited thematic programs.

## Publishing

Publishing is a Git operation. `npm run build` validates slugs, duplicates, field lengths and ids. Keep editorial commits small so content can be reverted independently of application code.
