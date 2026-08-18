# Supabase/Auth setup — KINOSIS 0.4.4.1

## Browser client

KINOSIS uses the Supabase Project URL and Publishable Key from `assets/js/config.js`. The Publishable Key is a client credential; RLS is the security boundary. Never put a Supabase Secret/Service Role key in frontend code.

## Database

Fresh project: run `supabase/SETUP_ALL.sql` once.

Already on the 0.4.1 core schema: there is no additional 0.4.4 migration. If the 0.4.2 curation experiment was installed, those unused tables can remain; the current app does not query them.

## Auth

The browser client uses PKCE. Configure Supabase Authentication URL Configuration with the production Netlify URL and allowed redirects.

Google/Kakao become available to ordinary users once each provider has been enabled in Supabase and its provider credentials/callback settings are configured in the corresponding developer console. Email magic-link sign-in remains available through Supabase Auth.

## Netlify health request

Set:

```text
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
```

The scheduled health Function performs a tiny read against `app_health`; it has no hard-coded fallback credentials.
