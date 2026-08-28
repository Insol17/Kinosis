# KINOSIS 0.4.6.6

## UX / UI
- Watch Now now uses standard KINOSIS poster cards, matching the Box Office object language while keeping OTT identity as a compact overlay.
- Genre preview and full directory share one wide-card grammar across 18 genres.
- Box Office remains an overview rail; no redundant full-view route is exposed.
- Hero arrows receive reserved side gutters and no longer sit over copy.
- Arthouse keeps the moving Hero and gains only restrained warm editorial cues; no numeric section ornaments are used.

## Collections
- Collection detail is film-first: compact context header, Library-sized seven-column works grid on wide screens.
- Movie search/add/remove moved into the Edit dialog. Changes are staged in a draft and only applied on Save.
- Collection membership no longer implies Library-shelf membership; adding a film to a Collection does not silently save it to `내 영화장`.
- The editor uses accent focus/selection cues while the detail page stays visually quiet.

## Navigation
- ARTHOUSE desktop submenu no longer stays pinned after pointer/focus leaves. Keyboard focus behavior remains explicit.

## Providers
- Movie-scoped provider artwork from the availability payload is preferred for Netflix/Disney+/etc.; first-party site icons are fallback only.

## Maintenance
- Removed superseded legacy Watch Now/Genre/Collection style rules to reduce cascade conflicts.
