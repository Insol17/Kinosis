# KINOSIS — Design system (0.4.4.3)

## Goal

Keep the existing DISCOVER / ARTHOUSE / LIBRARY / MY layout, but make the product read as one authored cinema service rather than a collection of dark UI panels.

## Typography

- One family: Pretendard Variable, with Korean system fallbacks.
- Korean word boundaries are protected with `word-break: keep-all`.
- Body copy targets 14–15px; metadata 11–13px; section titles 21–24px.
- English labels remain secondary and do not use a separate serif family.

## Color / material

- Base: graphite `#151619`, not pure black.
- Surfaces: subtle graphite steps rather than glass or deep-black cards.
- Accent: projector amber `#ffb347`, reserved for selection/state/focus.
- Most sections are separated by spacing and 1px rules instead of nested cards.

## Icon grammar

- 24px viewBox, rounded line caps/joins, 1.8 stroke.
- No black icon tile by default.
- Hero arrows, cinema state, mobile search, calendar navigation and utility icon buttons are transparent.
- Provider logos are not restyled because they are third-party brand assets.

## Layout invariants

The redesign does not change the product layout contract:

- DISCOVER and ARTHOUSE keep the Hero + horizontal seven-card rails.
- LIBRARY keeps the Steam-like left navigation + main management surface.
- MY keeps profile + tabs + content.
- Film detail keeps masthead + Where to Watch + main/side content grid.

## Motion

- Short opacity/transform transitions only.
- No expensive persistent backdrop blur.
- `prefers-reduced-motion` collapses transitions.

## Korean copy decisions

- `All Films` → `전체 영화`
- `Watchlist` → `보고싶어요`
- `Favorites` → `좋아요`
- `Collections` → `컬렉션`
- `OVERVIEW / REVIEWS / STATS / SETTINGS` → `개요 / 리뷰 / 통계 / 설정`
- Detail actions are Korean-first.

The top-level product IA remains DISCOVER / ARTHOUSE / LIBRARY / MY because those names function as stable service destinations rather than sentence-level UI copy.
