# Changelog

## 0.4.1 — Account Gate / Cloud Sync / ART MODE

- Gate LIBRARY and MY behind Supabase authentication.
- Gate Save, Log, Watchlist, Favorite and Collection mutations behind authentication.
- Add Google, Kakao and email magic-link sign-in UI.
- Add per-user cross-device Supabase `user_state` synchronization with RLS.
- Add signed-in local cache, offline fallback, reconnect retry and legacy local-state migration.
- Add sync status to MY -> ACCOUNT.
- Add Netlify Supabase health scheduled function (3/day).
- Add deterministic ART MODE feature classifier and Discover lens without visual theme changes.
- Add Art Cinema Library filter and art inclusion reasons in film detail.
- Extend weekly TMDB updater with art seed candidates, keywords and production company metadata.
- Extend live detail endpoint with keywords and production company metadata.
- Keep Search global and unaffected by ART MODE.
- Bump PWA shell/cache assets to 0.4.1.
