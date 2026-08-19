# KINOSIS 0.4.5.1 Patch Notes

0.4.5.1 is a user-facing polish pass over the Personal Film Library identity. It does not add the previously discussed Editorial Studio; that work is deferred until the public product surfaces are stable.

## Arthouse
- Arthouse no longer classifies a title as art-house from a broad auteur seed alone. Director affinity is now a supporting signal rather than a sufficient condition.
- Replaced the Tarantino archive with Christian Petzold to keep the programmed surface focused on art-house / auteur cinema.
- The Arthouse source pool now includes movies actually hydrated from Director Archives and Editorial Curations, rather than relying on the small static catalogue.
- Programme films are excluded from generic Arthouse rails, and the generic rails exclude each other, reducing repeated titles across the page.
- Director Archive rail labels no longer repeat `DIRECTOR'S ARCHIVE` twice.

## Library / Watchlist
- Watchlist is now its own `보고싶어요` Library surface sourced from FilmRelationship state.
- Watchlist-only films do not enter `전체 영화`; explicitly adding a film to the shelf remains a separate action.
- Library has separate first-use and filtered-empty states.
- Watchlist has its own count and empty state.

## Detail
- Removed the user-facing design-question copy (`이 영화는 무엇인가?`, `지금 어디서 볼 수 있는가?`, `나와 어떤 관계인가?`).
- Detail now uses terse catalogue labels: `작품 정보`, `감상 가능`, `내 기록`.
- Rating, one-line comment and primary personal actions remain in the hero; the lower personal area only contains actual viewing history and Collections.
- Availability copy was shortened to `제공 서비스` / `제공 정보 확인 중`.

## Loading / performance
- Search remote debounce reduced from 250ms to 180ms and now shows a spinner plus result-row skeletons while the remote result is pending.
- Movie-detail prefetch now works from film cards across the product, not only Search.
- Summary hydration runs in bounded parallel batches.
- Movie entity merge preserves enriched provider/cast/genre data when a lightweight response arrives later, preventing provider badges from disappearing after rerenders.
- Provider slots show an explicit skeleton while an availability request owns the pending state.

## Rails / navigation
- Desktop film rails now provide previous/next buttons and smooth shelf-sized movement instead of depending on a visible horizontal scrollbar.
- Touch/mobile retains native horizontal scrolling.

## Profile / calendar
- The public `MY` navigation concept is removed. The personal surface is `PROFILE`; the legacy internal route name remains for migration/routing compatibility only.
- Profile viewing-history rows were rebuilt so poster/action columns no longer squeeze the comment into a narrow strip.
- Viewing Calendar is now a fixed seven-column month grid with poster-filled viewing days, monthly viewing totals, count badges and existing day-detail drill-down.

## Visual direction
- Added flatter poster geometry, catalogue-style section rules, restrained amber indexing accents, stronger typographic hierarchy and shelf arrows to distinguish KINOSIS from generic streaming-card layouts without changing the core visual language.

## Deliberately deferred
- Editorial Studio / administrator CMS remains a valid future tool, but is not included in 0.4.5.1. Public product completeness has priority over an internal authoring surface for the portfolio build.
