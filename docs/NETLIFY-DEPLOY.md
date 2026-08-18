# Netlify deployment — KINOSIS 0.4.4.1

## Required environment variables

```text
TMDB_READ_ACCESS_TOKEN
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
```

For the actual Korean box-office ranking also add:

```text
KOBIS_API_KEY
```

Without the KOBIS key KINOSIS intentionally shows `현재 상영작` without rank numbers.

## Deploy

Push the 0.4.4.1 source to the linked GitHub branch. Netlify runs `npm run build`, publishes the static site and deploys Functions.

Smoke tests after deploy:

```text
/api/movie-search?q=시민 케인
/api/movie-detail?id=15
/api/box-office
```

`/api/box-office` should return `mode: "kobis"` when `KOBIS_API_KEY` is configured.

## Catalog refresh

Keep `TMDB_READ_ACCESS_TOKEN` in GitHub Actions Secrets. Add `KOBIS_API_KEY` there too if the generated catalog should carry exact KOBIS ranks. Run **Refresh movie catalog** once after upgrading.

## Offline/PWA

0.4.4.1 no longer ships or registers a Service Worker and no longer advertises an offline mode. Existing account-local state remains only for recovery and cloud synchronization.

## Editorial Curation build

`npm run build` validates `content/curations/*.curation.json` and generates `data/curations.js`. Director filmography network resolution happens only when that curation is opened, avoiding four background requests on every Arthouse visit.
