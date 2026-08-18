# KINOSIS MVP 0.4.2

## Product promise

KINOSIS connects four different film activities without turning them into one overloaded screen:

1. **Discover** — find something to watch.
2. **Arthouse** — explore cinema through editorial/auteur context.
3. **Library** — manage saved films efficiently.
4. **My** — review personal viewing history.

A film detail page is the bridge between public movie data and the user's activity.

## Core loop

```text
Discover / Arthouse
        ↓
      Detail
        ↓
 Where to Watch
        ↓
   Save / Log
        ↓
     Library
        ↓
        My
        ↓
  Return to discovery
```

## Guest policy

Guests can browse Discover, Arthouse, Search, and Detail. Personal data surfaces require authentication.

## Discover

One content-first page. No secondary tabs.
- Featured
- Now in Theatres
- My Streaming (signed in) / Streaming (guest)
- one KINOSIS Curation
- Trending
- Highly Rated

Cards expose at-a-glance theatre and OTT availability.

## Arthouse

Editorial destination combining deterministic candidate classification with human curation.
- Featured Curation
- Art-theatre candidates
- Director's Archive / other curations
- From the Archive
- My Streaming intersection

## Library

Management-oriented UI.
- Home dashboard
- All / Watchlist / Favorites / Collections
- compact grid and list view
- persistent search/filter/sort
- smaller poster density than Discover

## My

Autobiographical UI inspired by personal media profiles rather than asset management.
- Overview
- Diary
- Reviews
- Calendar
- Stats
- Settings

## Editorial admin

Admin/editor role is stored in Supabase and cannot be changed from the browser. The Curation Studio manages public editorial programming without code changes.

## Success criteria

- A guest understands what KINOSIS is before signing in.
- A signed-in user can find a saved film within seconds even with hundreds of titles.
- A film detail page explains both "what is this?" and "what is my relationship with it?"
- Discover and Arthouse feel edited, not like raw API result arrays.
- Navigation remains stable across desktop/mobile.
