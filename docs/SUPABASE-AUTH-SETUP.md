# Supabase/Auth setup — KINOSIS 0.4.4.3

KINOSIS uses Supabase Auth PKCE in the browser and RLS-protected user data.

## Browser configuration

`assets/js/config.js` contains only public client values:

- Supabase Project URL
- Publishable Key
- redirect URL

Never place `sb_secret_...` or a legacy `service_role` key in frontend code.

## Database

Fresh project: run `supabase/SETUP_ALL.sql`.

Existing project created before 0.4.4.3: run `supabase/004_kinosis_0443.sql`. This adds atomic revision writes for multi-device sync.

## Account deletion

Account deletion is intentionally not executed from the browser with elevated credentials.

Set these in Netlify Environment Variables:

```text
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY
```

`/api/delete-account` first validates the caller's bearer access token, then uses the server-only Secret Key to delete that exact authenticated user. `public.user_state` is deleted by the existing `auth.users(id) ON DELETE CASCADE` foreign key.
