# Netlify deployment — KINOSIS 0.4.1

GitHub remains the source repository. Push to the connected branch; Netlify deploys the static site and Functions automatically.

## Existing secret

Keep:

```text
TMDB_READ_ACCESS_TOKEN
```

This is required by the TMDB live search/detail Functions.

## Supabase

The Supabase Project URL and Publishable Key are public client configuration and currently live in `assets/js/config.js`. No Supabase Secret or service-role key is required by 0.4.1.

Optional Netlify variables `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` may override the scheduled health function, but the checked-in fallbacks are public values and are not credentials that bypass RLS.

## Scheduled health request

`netlify/functions/supabase-health.mjs` runs at 00:17 / 08:17 / 16:17 UTC (09:17 / 17:17 / 01:17 KST) and performs a tiny external SELECT on `app_health`.

This is a reliability/health measure, not a guarantee that Supabase Free will never pause.

## Required database install

Run `supabase/001_kinosis_041.sql` before testing signed-in Library/MY.
