# KINOSIS 0.4.5.1

**KINOSIS is a Korea-first Personal Film Library — 나만의 영화장.**

It brings film discovery, current viewing availability, a present-tense shelf, watchlist, personal ratings/comments, viewing history and Collections together around one Movie Entity. Physical/digital ownership, social feeds, AI recommendations and an Editorial CMS remain outside this portfolio build.

```text
DISCOVER  → 일반적인 영화 발견
ARTHOUSE  → 감독 아카이브 / 에디토리얼을 통한 맥락형 발견
DETAIL    → 작품 정보 / 감상 가능 / 내 평가·기록
LIBRARY   → 내 영화장 + 별도의 보고싶어요 + Collections
PROFILE   → 감상 기록 / 한줄평 / 캘린더 / 통계 / 설정
```

## 0.4.5.1 focus

- **Arthouse quality:** dynamic Director Archive / Editorial films join the source pool; broad auteur seeds no longer classify mainstream titles by themselves; cross-rail repetition is suppressed.
- **Watchlist semantics:** `보고싶어요` is visible inside Library but stays separate from `전체 영화` membership.
- **Detail language:** internal design questions were removed from the UI. Hero owns rating/comment/actions; `내 기록` only shows real personal history.
- **Loading feedback:** Search has explicit spinner/skeleton states, film cards prefetch Detail, summary hydration is parallelized, and entity merges preserve provider data.
- **Shelf navigation:** desktop rails have previous/next controls while touch keeps native scrolling.
- **Profile consolidation:** MY is no longer a public navigation concept; Profile owns overview, records, calendar, stats and settings.
- **Calendar:** fixed seven-column poster month inspired by film-diary calendars rather than spreadsheet-like tiny cells.
- **Visual polish:** flatter archive geometry, section indexing rules and a stronger catalogue/shelf hierarchy.

See `docs/ARCHITECTURE-0.4.5.1.md` and `PATCH-0.4.5.1.md`.

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
