# Netlify deployment — KINOSIS 0.4.2

GitHub remains the source repository. Netlify continuously deploys the connected branch.

## Required Netlify environment variables

```text
TMDB_READ_ACCESS_TOKEN
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
```

`TMDB_READ_ACCESS_TOKEN` is secret and must never be shipped to the browser.

The Supabase URL/Publishable Key are public client configuration values, but Netlify needs them separately because the scheduled health Function no longer contains source-code fallbacks.

## Production deploy

1. Replace repository files with the 0.4.2 package.
2. Commit and push to GitHub.
3. Netlify automatically deploys static files and Functions.
4. Run the Supabase SQL migration.
5. Run GitHub `Refresh movie catalog` once.

## Verify

TMDB search:

```text
https://kinosis.netlify.app/api/movie-search?q=시민%20케인
```

Supabase auth:
- Google/Kakao provider must be enabled separately.
- Email magic link works once Supabase email auth is enabled and redirect URLs are correct.

PWA cache version is 0.4.2 and old KINOSIS caches are removed during service-worker activation.
