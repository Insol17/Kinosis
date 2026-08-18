# Changelog

## 0.4.2 — Unified Product UX

### Information architecture
- Top-level navigation is now fixed to **DISCOVER / ARTHOUSE / LIBRARY / MY**.
- Removed Discover's old HOME / IN THEATRES / MY STREAMING / STREAMING / TOP RATED secondary tabs.
- **ARTHOUSE** replaces ART MODE and becomes a permanent editorial destination.
- Movie detail is now a full page in the SPA instead of a large modal.

### Discover
- Rebuilt as a content-first home rather than a feature menu.
- Sections: Featured / Now in Theatres / My Streaming (or Streaming for guests) / one KINOSIS Curation / Trending / Highly Rated.
- Movie cards show up to two OTT provider logos and an in-theatres film icon directly on the poster.
- Featured banner remains promotional: no Library / Log buttons inside the banner.

### Arthouse
- Combines the previous ART MODE classifier and editorial curation system.
- Sections support Featured Curation, art-theatre titles, Director's Archive, From the Archive, and subscribed-service availability.
- The deterministic classifier remains an internal candidate generator; it is no longer a user-facing toggle.

### Library
- Rebuilt around management, not browsing.
- Smaller, denser poster grid.
- Added compact list view.
- Added persistent search/filter/sort toolbar.
- Library Home prioritizes recent viewing, watchlist titles available on subscribed OTTs, collections, and favorites.

### My
- Reworked into a Watcha-inspired personal film-life surface.
- Profile cover, avatar, film/rating/review/collection counts.
- Reduced navigation to Overview / Diary / Reviews / Calendar / Stats / Settings.
- Subscriptions and Account moved into Settings to reduce navigation clutter.

### Detail
- Full-page film hub with backdrop, poster, metadata, actions, Where to Watch, About, My Activity, and related films.
- Netlify detail API now returns top cast data.

### Curation / Admin
- Added Supabase-backed `user_roles`, `curations`, and `curation_movies` schema.
- Added RLS-protected editor/admin write access.
- Added hidden **Curation Studio** accessible from MY → Settings for editor/admin accounts.
- Curations can target Discover, Arthouse, or both, and can be Draft/Published.
- Admins can search TMDB through the existing KINOSIS live-search proxy and add films without entering metadata manually.

### Auth / UX consistency
- Supabase Auth switched from implicit flow to PKCE.
- Removed native `prompt()`, `confirm()`, and `alert()` usage; KINOSIS dialogs/toasts are used instead.
- Guests can browse Discover, Arthouse, Search, and Detail. Library/MY and personal actions remain account-gated by product policy.

### Operations
- Supabase health function now requires Netlify environment variables instead of shipping fallback values.
- PWA shell cache bumped to 0.4.2 and old KINOSIS caches continue to be removed on activation.
