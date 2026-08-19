# KINOSIS 0.4.5

**KINOSIS is a Korea-first Personal Film Library — 나만의 영화장.**

It brings discovery, current viewing availability, personal relationships, viewing history and Collections together around one Movie Entity. The portfolio scope intentionally does not add social feeds, AI recommendations, country selection, newsletters, physical ownership or digital-purchase tracking.

```text
DISCOVER  → find a film
ARTHOUSE  → find a film with editorial/director context
DETAIL    → what is it / where can I watch / what is my relationship
LIBRARY   → the films currently on MY SHELF + personal Collections
MY        → viewing history / comments / stats / settings
```

## 0.4.5 focus

- **Personal Film Library IA:** Watchlist/Favorite/Rating are relationship filters, not sibling Library destinations. Collections and MY SHELF have separate hierarchy.
- **Contextual Movie Card:** Discover, Library and MY use the same Movie Entity but surface task-specific information.
- **Three-question Detail:** `ABOUT THE FILM` → `WHERE TO WATCH` → `MY FILM`.
- **Visible Library relationship:** `내 영화장에 담기` is promoted to a first-class Detail action.
- **Non-destructive shelf removal:** removing LibraryMembership keeps ratings, comments, viewing events, watchlist/favorite and Collection links.
- **No ownership scope creep:** subscription/theatrical access is not presented as physical/digital ownership.
- **Architecture:** Library policy lives in `features/library.js`; card representation policy lives in `ui/movie-card.js`; domain/network boundaries remain explicit.

See `docs/ARCHITECTURE-0.4.5.md` and `PATCH-0.4.5.md`.

## Run

Production-like local environment:

```bash
netlify dev
```

Static fallback:

```bash
npm run serve
```

## Test

```bash
npm test
npm run test:browser
```

The browser smoke harness may report `SKIP` in environments whose installed Chromium policy blocks local HTTP origins.

## Environment variables

### Netlify

```text
TMDB_READ_ACCESS_TOKEN
KOBIS_API_KEY
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY
```

`SUPABASE_SECRET_KEY` is server-only and must never ship in frontend assets.

## Supabase

Fresh project: run `supabase/SETUP_ALL.sql`. Existing 0.4.x installations use the existing migration chain documented in `docs/ACCOUNT-MIGRATION.md`.

## Editorial source

`content/curations/*.curation.json` is the Git-backed editorial source. Director Archive and Editorial Curation remain separate domain types.

## Data sources

- TMDB: film metadata, images, recommendations and JustWatch-derived provider availability.
- KOBIS: Korean daily box office when configured.
- KINOSIS editorial files: Arthouse Director Archive / Editorial Curation definitions.

TMDB attribution is included in the product UI.
