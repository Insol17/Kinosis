# KINOSIS 0.4.6.3

## UX correction

### Collection detail is works-first

The Collection page no longer presents movie addition as a large second content block. The hierarchy is now:

1. Collection identity and description
2. Works count + compact add-search field
3. Existing movie grid
4. Optional ordering editor

Search is dormant when empty. No suggested/recommended eight-film list is rendered before the user expresses intent. Search results are an overlay and therefore do not push the existing collection down the page.

Search is also intentionally **add-only**. If a result already belongs to the Collection it reads `✓ 추가됨`. Removal happens on the existing work itself through a small poster-level remove control. This matches the user's mental model: search is for finding something new; the collection is where existing membership is edited.

### Discover Curation spotlight

The former single static Curation promo is replaced by a three-slide doorway into Arthouse. The authored order prioritizes:

1. `결국 가족이다`
2. `고독한 방황`
3. `누벨바그 걸작선`

The spotlight supports explicit previous/next controls, touch swipe and indicator dots. Autoplay is gated by `IntersectionObserver`, so it starts only when the spotlight is meaningfully visible and it pauses after deliberate keyboard/pointer interaction. `prefers-reduced-motion` disables automatic movement.

### Surface grammar

Discover retains rounded, responsive product surfaces. Its Curation doorway is a compact moving spotlight rather than an archive index. Arthouse keeps warmer, flatter, framed editorial surfaces, numbered sections and portrait-first Director cards. The palette remains shared so both still read as KINOSIS.

The Arthouse overview Hero is now a static editorial masthead instead of another Curation carousel. This removes the previous duplication where the same authored programmes appeared once in the Hero and again immediately in the Curation preview, while giving Arthouse a calmer archive identity distinct from Discover's moving discovery surfaces.

## Architecture

New responsibility boundary:

```text
assets/js/features/discover-curation-carousel.js
  ├─ selectDiscoverCurations()
  ├─ renderDiscoverCurationCarousel()
  └─ createDiscoverCurationCarouselController()
```

Collection persistence remains in `collection-editor.js`; collection lookup remains in `collection-search.js`; application composition remains in `app.js`.

## Regression contracts

- Collection search renders no recommendations while query is empty.
- Collection search can add but cannot remove from search results.
- Collection detail renders Works before the add-search affordance.
- Discover selects the three intended editorial programmes for its spotlight.
- Discover spotlight exposes previous/next navigation and viewport/reduced-motion autoplay guards.
