# KINOSIS 0.4.4 — Curation Architecture

## Decision

Curation remains a KINOSIS editorial feature, but authoring is not a user-facing Admin product. The repository is the CMS. This keeps editorial publishing under normal Git review and avoids maintaining roles, editor UI, draft DB state, and moderation rules for a one-person editorial workflow.

## Flow

```text
content/curations/<surface>/*.curation.json
        ↓
npm run build / Netlify build
        ↓
data/curations.json + data/curations.js
        ↓
DISCOVER / ARTHOUSE
        ↓
?curation=<slug>
```

The weekly TMDB catalog and editorial curations are independent. A curation can reference any TMDB movie ID. If a referenced film is absent from the local weekly catalog, the browser asks the existing Netlify `movie-detail` proxy for metadata; the TMDB token remains server-side.

## Surface policy

- DISCOVER: maximum one Curation module to keep the home simple.
- ARTHOUSE: compact Curation rail; deeper editorial browsing belongs here.
- `both`: eligible for both surfaces.

## Editing policy

Publishing is a Git operation. Use feature-sized commits so a bad curation can be reverted without reverting unrelated code. `draft`/disabled definitions should use a filename that does not end in `.curation.json`, or set `status: "draft"` / `enabled: false`.

## Source format

See `content/curations/README.md` for the exact JSON fields.
