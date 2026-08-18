# Netlify deployment — KINOSIS 0.4.4.3

## Required environment variables

```text
TMDB_READ_ACCESS_TOKEN
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
```

For exact Korean daily box-office ranks:

```text
KOBIS_API_KEY
```

For Settings → account deletion:

```text
SUPABASE_SECRET_KEY
```

`SUPABASE_SECRET_KEY` is server-only. Never put it in `config.js`, `index.html`, browser JavaScript, screenshots, or a public repository.

## Supabase migration

If upgrading an existing 0.4.x database, run:

```text
supabase/004_kinosis_0443.sql
```

Fresh projects can run `supabase/SETUP_ALL.sql` instead.

## Deploy

Push the 0.4.4.3 source to the branch connected to Netlify. Netlify installs package dependencies, runs `npm run build`, publishes the static site and bundles Functions.

After deployment, test:

1. Google login.
2. Modify a Watchlist item and confirm Cloud Sync reaches `ONLINE`.
3. Open the same account in another browser and confirm the item arrives automatically.
4. Open a Director Curation and confirm it loads once without sustained CPU/render churn.
5. In MY → Settings, select OTT services and confirm `내 구독 서비스에서` returns live results.
6. Check a WATCHA title and confirm the official WATCHA wordmark is shown once, not the incorrect upstream tile.

KINOSIS 0.4.4.3 does not ship an offline/PWA shell.
