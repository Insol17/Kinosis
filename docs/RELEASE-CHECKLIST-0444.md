# KINOSIS 0.4.4.4 — Release checklist

1. Existing 0.4.4.3 Supabase project: **no new SQL**. Confirm `supabase/004_kinosis_0443.sql` was already applied.
2. Netlify environment variables:
   - `TMDB_READ_ACCESS_TOKEN`
   - `KOBIS_API_KEY` for exact Korean daily box-office ranking
   - `SUPABASE_URL`
   - `SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SECRET_KEY` only if account deletion is enabled
3. Run `npm test` locally.
4. Push the source connected to Netlify.
5. Run GitHub Actions → `Refresh movie catalog` once. 0.4.4.4 also has `/api/upcoming` as a temporary live fallback when an older bundled snapshot is thin.
6. Smoke-test:
   - Discover Hero → film detail → Back
   - Search one known film and confirm it appears once
   - Open Víctor Erice Curation and confirm feature-film-only unique results
   - Detail → Where to Watch; confirm Netflix/WATCHA variants are consolidated
   - Create/edit/delete a viewing Log
   - On a second signed-in browser, confirm Cloud sync and delete propagation
7. Mobile: test Hero swipe, Detail action buttons and cast horizontal rail.
