# KINOSIS 0.4.4.1 — Curation architecture

Curation is an ARTHOUSE-only editorial feature. Authoring is intentionally repository-based for the current one-editor workflow; no Admin account or Curation database is required.

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

## Director source

```json
{
  "slug": "kiarostami",
  "title": "그럼에도 삶은 계속된다: 키아로스타미 컬렉션",
  "source": {
    "type": "director",
    "name": "Abbas Kiarostami",
    "sort": "release_asc"
  }
}
```

The source is not expanded on the Arthouse landing. Opening the Curation resolves the director once through the Netlify TMDB proxy and renders all movie directing credits returned for that person.

Static `movies: [TMDB_ID, ...]` definitions remain supported for hand-edited thematic programs.

## Publishing

Publishing is a Git operation. `npm run build` validates slugs, duplicates, field lengths and movie IDs before deployment. Keep Curation edits in small commits so an editorial mistake can be reverted independently of application code.
