# KINOSIS 0.2.1 MVP — Product Spec

## Product definition

KINOSIS is a Korean-first personal film discovery and logging product. The MVP is organized around three top-level jobs:

1. **DISCOVER — What should I watch?**
   - Home
   - In Theatres (KR)
   - My Streaming
   - Streaming
   - Top Rated
2. **LIBRARY — What have I saved, and how do I find it again?**
   - Library Home
   - All Films
   - Watchlist
   - Favorites
   - Manual Collections
   - Dynamic Collection: Watchlist × My Streaming
3. **MY — What is my history with film?**
   - Profile
   - Diary
   - Reviews
   - Calendar
   - Stats
   - Subscriptions

The distinction is intentional: Library is a content-management workspace; MY is a personal record/profile surface.

## Core loop

Discover/Search → Save or Log → Watch/Review → Library → MY Diary/Calendar → rediscover from Watchlist/My Streaming.

## Friction rule

Adding a film must not require opening its detail page. Search results expose:

- `+` one-click Save
- `LOG` direct viewing log

Detail remains optional.

## Streaming model

The app never claims to know whether the user actually pays for a service. The user manually toggles subscriptions in MY. A film is shown as **available on my subscription** only when:

- user marked provider as subscribed; and
- KR watch-provider data says the title is offered as subscription/flatrate.

Rental/purchase offers stay separate.

## Library model

Steam is used as an information-architecture reference rather than a visual clone:

- library sidebar on desktop
- Home shelves
- search/sort
- manual collections
- dynamic collections
- quick re-entry into recent content

## Viewing log model

`watched = true` is not enough. Every viewing is a separate log with `movieId`, `watchedAt`, optional `rating`, and optional `review`. The calendar is a projection of these logs, so rewatches remain visible.

## Account strategy

0.2 is **local-first** and has no mandatory account. This keeps the GitHub Pages MVP zero-cost and avoids pretending that browser local storage is cloud identity.

Phase 2 adds optional cloud sync with Auth + RLS. The local state shape already maps to the provided Supabase schema.

## Mobile strategy

The website is responsive and installable as a PWA over HTTPS. Desktop uses top navigation and a Library sidebar. Mobile uses bottom navigation:

Discover / Search / Library / My

A native wrapper can be considered after the mobile web flow is validated; the data model should remain shared.

## MVP success tests

- Search → Save within 2 actions.
- Search → Log within 2 actions plus log fields.
- User can identify a Watchlist film available on a subscribed service without opening every detail page.
- Library remains navigable with at least 100 saved films through search/sort/collections.
- Calendar correctly shows multiple viewing logs for the same film.
- Mobile flow is usable without desktop-only hover interactions.
