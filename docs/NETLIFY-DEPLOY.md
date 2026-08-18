# Netlify deployment — KINOSIS 0.4.3.2

KINOSIS source remains in GitHub. Netlify deploys the repository and runs the serverless TMDB proxy Functions.

## Required Netlify environment variables

```text
TMDB_READ_ACCESS_TOKEN
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
```

## Deploy

Push 0.4.3.2 to the linked GitHub branch. Netlify deploys the site and Functions automatically.

After deployment test:

```text
/api/movie-search?q=시민 케인
/api/movie-recommendations?id=15
```

The first should return movie/person search data; the second should return recommendation candidates.

## Catalog refresh

Keep `TMDB_READ_ACCESS_TOKEN` in GitHub Actions Secrets as well. Run **Refresh movie catalog** once after upgrading so the new multi-page theatre sync and expanded Arthouse seed pool are written to `data/catalog.js/json`.

PWA cache version is 0.4.3.2 and old `kinosis-*` shell caches are removed on activation.


## Editorial Curation build

Netlify now runs `npm run build` before publish. That command validates `content/curations/*/*.curation.json` and generates `data/curations.js`. Do not remove the build command from `netlify.toml` if file-based curations are in use.
