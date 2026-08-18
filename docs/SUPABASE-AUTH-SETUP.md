# Supabase/Auth setup — KINOSIS 0.4.2

## Existing project values

The frontend uses the Supabase Project URL + Publishable Key in `assets/js/config.js`. These are public client values; security is enforced through RLS.

Never put `service_role`, `sb_secret_...`, or database passwords in frontend files.

## URL configuration

Site URL:

```text
https://kinosis.netlify.app/
```

Redirect allow list:

```text
https://kinosis.netlify.app/**
http://localhost:8888/**
```

0.4.2 uses Supabase PKCE auth flow.

## SQL

Fresh project:

```text
supabase/SETUP_ALL.sql
```

Already ran 0.4.1:

```text
supabase/002_kinosis_042.sql
```

## Google provider

Create a Google OAuth Web Application.

Authorized JavaScript origin:

```text
https://kinosis.netlify.app
```

Authorized redirect URI:

```text
https://uqntdtjqeernzqpbymex.supabase.co/auth/v1/callback
```

Paste the Google Client ID/Secret into Supabase Authentication → Sign In / Providers → Google.

## Kakao provider

Create the Kakao Developers app, enable Kakao Login, register the Supabase callback URL shown in the Supabase Kakao provider settings, then enter the REST API credentials in Supabase.

## Admin assignment

Sign in once so the user exists in `auth.users`, then run:

```sql
insert into public.user_roles (user_id, role)
select id, 'admin' from auth.users where email = 'YOUR_EMAIL@example.com'
on conflict (user_id) do update
set role = excluded.role, updated_at = now();
```

The browser cannot promote itself because authenticated clients have no INSERT/UPDATE permission on `user_roles`.

## Netlify health environment

Add:

```text
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
```

The scheduled health check uses these values three times per day. 0.4.2 does not hard-code fallback credentials in the Function source.
