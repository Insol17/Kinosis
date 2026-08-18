# Changelog

## 0.4.4.1 — Detail, performance and theatrical-data pass

### Performance / cleanup
- Removed Service Worker / manifest offline shell and the unused hidden For You client loop.
- Render only the active top-level surface instead of rebuilding Discover, Arthouse, Library and MY together.
- Arthouse landing no longer resolves director filmographies; a curation resolves its dynamic source only when opened.
- Live box-office arrival updates only Discover content and no longer rebuilds the Hero.
- Removed legacy Library Home and obsolete advanced-filter code paths.
- Detail backdrops are capped at TMDB w1280 instead of `original`.
- Added `content-visibility` containment and removed expensive shell/toolbar backdrop blur in the 0.4.4.1 visual layer.

### Box office / theatrical state
- Added `/api/box-office` backed by the official KOBIS daily box-office API.
- TMDB popularity is never presented as a box-office rank. If KOBIS is unavailable the UI shows an unranked `현재 상영작` shelf.
- KOBIS Korean opening dates are preferred for matched box-office titles.
- Film detail now reads KR theatrical release dates and exposes current/upcoming theatrical state generically; no movie-title-specific patches are used.

### Film detail / Where to Watch
- Rebuilt film detail into a stronger editorial information page with masthead, actions, rating, synopsis/facts, cast, personal history and related films.
- Whole Hero surfaces now open the corresponding film detail.
- Where to Watch is an inline full-width surface rather than a cramped side utility.
- Provider variants are consolidated by canonical brand, removing duplicate Netflix/ad-tier tiles.
- Current theatrical films show a `극장 · 현재 상영 중` option even when there is no OTT provider.
- Director and genre values are direct exploration actions.

### P0 data integrity
- Rewatch flags are recalculated from chronological viewing history after create/edit/delete.
- Current Library rating becomes null when no rated viewing log remains instead of preserving a stale value.
- Complete Library-film removal and Collection deletion now have cloud tombstones so stale devices do not resurrect them.

### Motion / visual system
- Added a new `editorial-0441.css` layer: warmer cinema typography, stronger hierarchy, restrained section/view/Hero transitions, film-card hover behavior and a redesigned detail surface.
- Motion uses transform/opacity and honors `prefers-reduced-motion`.

## 0.4.4 — Discovery rails, reliable cloud sync, simpler Library

### Discover
- Featured is now a 3–5 film carousel with arrows, indicators, 6.5s autoplay, hover/focus pause, and reduced-motion opt-out.
- Default section order is now: Box Office / Upcoming / My Services / Highly Rated.
- Added generated `boxOffice` and `upcoming` catalog sections.
- Exact Korean daily box-office ranks use optional KOBIS data. Without a KOBIS key, KINOSIS falls back to TMDB theatrical popularity and labels the shelf `극장 인기 순위` rather than inventing box-office ranks.

### Arthouse
- Uses the same carousel and poster-card grammar as Discover.
- Default order is Latest Releases / Highly Rated / four Arthouse curations.
- Removed the sparse `지금 아트시네마에서` rail and the separate compact Arthouse card sizing.

### Poster density
- Desktop horizontal rails are capped at exactly seven visible poster cards within the 1600px content shell.
- Wider monitors do not reveal additional cards; they preserve the same seven-card composition.
- Library and curation grids also cap at seven columns on desktop.

### Library
- Removed Library Home, stats cards, explanatory feed sections, and the large multi-filter bar.
- Default Library opens directly to All Films.
- Steam-like left navigation: All Films / Watchlist / Favorites / Collections + personal collection shortcuts.
- Main surface keeps only search, sort, Grid/List view, and the selected library content.

### Cloud Sync v2
- Sync is now bidirectional instead of push-only after initial login.
- Pulls cloud state on focus, visibility return, reconnect, manual sync, and a low-frequency foreground interval.
- Before a push, KINOSIS checks for a newer remote row and merges item-level timestamps instead of blindly overwriting another device.
- Added viewing-log deletion tombstones so a deleted log does not reappear from another device's stale state.
- Added subscription and profile update timestamps for safer conflict resolution.
- Cloud Settings now exposes the actual Supabase error message; missing schema/RLS errors are translated into actionable messages.

### Curations
- Curations remain Git-authored and Arthouse-only; no Admin account is required.
- `source.type = "director"` can now resolve every TMDB movie directing credit for a named director at runtime.
- Added four built-in Director's Archives:
  - 그럼에도 삶은 계속된다: 키아로스타미 컬렉션
  - 셀룰로이드의 정령: 빅토르 에리세 컬렉션
  - 파도치는 시대를 관조하는 시선: 허우샤오시엔 컬렉션
  - 폭발하는 도파민: 쿠엔틴 타란티노 컬렉션
- Director curations auto-expand when TMDB adds a new directing credit; static TMDB-ID curation files remain supported.

### Operations
- Added `/api/director-filmography` Netlify Function.
- Catalog refresh supports optional `KOBIS_API_KEY` GitHub Secret.
- PWA cache version bumped to 0.4.4.
