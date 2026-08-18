# KINOSIS 0.4.4.3 — Release checklist

## Required once on an existing Supabase project
Run `supabase/004_kinosis_0443.sql` in Supabase SQL Editor. It adds the cloud revision column and atomic write RPC used by 0.4.4.3.

For a fresh project, run `supabase/SETUP_ALL.sql` instead.

## Netlify environment
Keep the existing variables:
- `TMDB_READ_ACCESS_TOKEN`
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `KOBIS_API_KEY` (optional, but required for real Korean box-office ranks)

To enable self-service account deletion, add **server-side only**:
- `SUPABASE_SECRET_KEY`

Never expose `SUPABASE_SECRET_KEY` in frontend files, GitHub source, screenshots, or chat.

## Deploy
1. Replace the existing project files while keeping `.git`.
2. `git add .`
3. `git commit -m "KINOSIS 0.4.4.3"`
4. `git push`
5. Confirm the Netlify build runs `npm run build`.
6. Run GitHub Actions → `Refresh movie catalog` once if the updater or KOBIS data needs refreshing.

## Smoke test after deploy
- Google login → Library data appears automatically.
- Change a rating on one device and verify the second device receives it after focus/refresh.
- Open each of the four Director Curations and verify the page settles after one data load (no render loop).
- Check WATCHA, Netflix, Disney+, TVING, Wavve and Prime Video marks in poster overlays, Settings, and Where To Watch.
- Verify Netflix ad/non-ad variants render as one Netflix brand in Where To Watch.
- Open a currently theatrical film and verify the cinema row appears when the data source marks it current.
- Check Discover → `내 구독 서비스에서` after selecting subscriptions.
- Test account deletion only after `SUPABASE_SECRET_KEY` is configured.
