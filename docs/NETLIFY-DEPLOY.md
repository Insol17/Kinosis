# Netlify deployment — KINOSIS 0.4.5.7

## Environment variables

Set these in **Netlify → Project configuration → Environment variables**.

```text
TMDB_READ_ACCESS_TOKEN
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
```

For Korean theatrical ingestion:

```text
KOBIS_API_KEY
```

`KOBIS_API_KEY` and `TMDB_READ_ACCESS_TOKEN` should be available to **Builds + Functions** (or All scopes). They must never be exposed to browser code.

For account deletion only:

```text
SUPABASE_SECRET_KEY
```

After changing environment variables, trigger a new deploy. The build runs `update-theatrical.mjs --if-keys`, so a deploy with both KOBIS/TMDB build secrets produces a fresh KR theatrical snapshot immediately; if either secret is absent it keeps the committed last-known-good snapshot.

## GitHub Actions secrets

The repository's daily Korean theatrical snapshot uses GitHub Actions. Add the same secret values under **Repository Settings → Secrets and variables → Actions**:

```text
KOBIS_API_KEY
TMDB_READ_ACCESS_TOKEN
```

`refresh-theatrical.yml` runs once daily. User traffic reads the committed snapshot and does not spend the KOBIS daily quota.

## Supabase

Fresh project:

```text
supabase/SETUP_ALL.sql
```

Existing 0.4.5.3 project:

```text
supabase/006_kinosis_0454.sql
```

The 0.4.5.7 migration adds lightweight Studio list metadata so the Studio home does not download every full Director snapshot.

## Admin role

KINOSIS uses only `user` and `admin`. Give a normal Auth user the trusted claim:

```sql
update auth.users
set raw_app_meta_data =
  coalesce(raw_app_meta_data, '{}'::jsonb)
  || '{"user_role":"admin"}'::jsonb
where id = 'USER_UUID';
```

Then sign out and sign in again so a fresh JWT contains the claim.

## Deploy verification

1. Discover paints Box Office/Upcoming from `window.KINOSIS_THEATRICAL` without waiting for KOBIS.
2. `/api/box-office` and `/api/upcoming` return snapshot data.
3. Arthouse Director Archives show committed/build snapshots immediately.
4. Studio opens its shell immediately, then loads the lightweight programme list.
5. Star hover leaves no uncommitted visual rating after pointer exit.
6. Profile calendar uses horizontal stills on desktop and agenda rows on mobile.
