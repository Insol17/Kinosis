# KINOSIS 0.4.2

KINOSIS is a film discovery, editorial curation, personal library, and viewing-history web MVP.

## Product structure

```text
DISCOVER  → content-first everyday discovery
ARTHOUSE  → auteur / art-cinema / editorial curations
LIBRARY   → logged-in film management
MY        → logged-in personal film history
```

The product intentionally separates these four jobs. Search is a global action, not a fifth destination.

## Stack

- Static HTML/CSS/vanilla JS
- Netlify hosting + Functions
- TMDB live search/detail proxy
- GitHub Actions catalog refresh
- Supabase Auth + per-user cloud state
- Supabase RLS-protected curation/admin tables
- PWA service worker

## Deploy update

1. Replace the repository contents with this folder (keep `.git`).
2. Push to GitHub.
3. Netlify deploys automatically from GitHub.
4. Run the Supabase SQL described below.
5. Run the GitHub `Refresh movie catalog` workflow once after deployment.

## Supabase SQL

If you have not run any KINOSIS schema yet, run:

```text
supabase/SETUP_ALL.sql
```

If 0.4.1 schema is already installed, run only:

```text
supabase/002_kinosis_042.sql
```

### Assign your admin account

After signing in once, run this manually in Supabase SQL Editor with your actual email:

```sql
insert into public.user_roles (user_id, role)
select id, 'admin' from auth.users where email = 'YOUR_EMAIL@example.com'
on conflict (user_id) do update
set role = excluded.role, updated_at = now();
```

Never expose a service-role/secret key in frontend code.

## Netlify environment variables

Existing TMDB live-search setup:

```text
TMDB_READ_ACCESS_TOKEN
```

For the scheduled Supabase health request, add these public client values to Netlify Environment Variables:

```text
SUPABASE_URL=https://uqntdtjqeernzqpbymex.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

The health function intentionally has no hard-coded fallback in 0.4.2.

## Google / Kakao login

The frontend is ready for Google, Kakao, and Email magic-link auth. Google/Kakao only work for ordinary users after their provider credentials and public OAuth settings are completed in Supabase + the provider console.

Supabase Site URL currently expected by the shipped config:

```text
https://kinosis.netlify.app/
```

## Admin Curation Studio

Editors/admins get **MY → Settings → KINOSIS Admin**.

A curation contains:
- title / subtitle / description
- surface: Discover / Arthouse / Both
- type: Director's Archive / Selection / Theme
- status: Draft / Published
- ordered TMDB movie list

Published curations are publicly readable. Drafts and write operations are restricted by RLS to editor/admin accounts.

## Guest policy

This version intentionally keeps personal surfaces gated:

- Guest: Discover / Arthouse / Search / Detail
- Signed-in: Library / My / Save / Log / Watchlist / Favorite / Collections

This is a product decision, not a technical limitation.

## Test

```bash
npm test
```

Expected suites:
- catalog
- static/product-surface checks
- Netlify TMDB function contract
- Arthouse classifier

## Data-source notice

Movie metadata/images: TMDB. Watch-provider availability: JustWatch via TMDB. The site includes the required TMDB non-endorsement notice and JustWatch attribution surface.
