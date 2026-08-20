# KINOSIS 0.4.5.2

**KINOSIS is a Korea-first Personal Film Library — 나만의 영화장.**

It brings film discovery, current viewing availability, a present-tense shelf, a separate watchlist, ratings/comments, viewing history and Collections together around one Movie Entity. Physical/digital ownership, social feeds, AI recommendations and an Editorial CMS remain outside this portfolio build.

```text
DISCOVER  → 넓고 빠른 영화 발견
ARTHOUSE  → 에디토리얼 / 감독 아카이브를 통한 맥락형 발견
DETAIL    → 작품 정보 / 감상 가능 / 현재 평가·기록
LIBRARY   → 현재 내 영화장 + 별도의 보고싶어요 + Collections
PROFILE   → 감상 기록 / 평가 / 한줄평 / 캘린더 / 통계 / 설정
```

## 0.4.5.2 focus

- **Shelf mental model:** watchlist-only remains separate, while rating, one-line comment, favorite, a new viewing event or Collection membership makes the film part of the current shelf. A later manual shelf removal remains non-destructive and is not silently resurrected on reload.
- **Viewing integrity:** current FilmRelationship and historical ViewingEvent snapshots are edited through separate controls. Editing an old viewing can no longer overwrite the current rating/comment.
- **Arthouse reliability:** the page is programme-driven rather than padded with generic pseudo-personal rails. Director Archives ship stable person IDs and static snapshot fallbacks, then live-refresh without turning network errors into fake empty filmographies.
- **Arthouse Hero:** one representative slot per programme, curation-aware Hero navigation, stable director identity and no `감독 정보 없음` placeholder in the large Hero.
- **Discover breadth:** Hero selection rotates across sources, nearby rails suppress visible repetition, and the high-rated rail uses confidence-weighted ranking instead of raw averages.
- **Search continuity:** explicit loading feedback remains, result actions no longer nest inside ARIA options, Search closes for Detail and restores the previous query/results when returning.
- **Profile coherence:** PROFILE is the only public personal surface. The avatar opens an account popover; Profile counters drill into the matching viewing/rating/comment/collection archive.
- **Portfolio demo:** `KINOSIS 둘러보기` loads a session-only seeded film life without a shared account or Cloud writes.
- **Regression cleanup:** fixed the oversized orange Hero indicator, stale relationship records, collection-create-from-film flow and several obsolete CSS/code paths.

See `docs/ARCHITECTURE-0.4.5.2.md` and `PATCH-0.4.5.2.md`.

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

`npm test` includes build validation, `checkJs` type checking, function/domain/runtime regression tests and Discovery/Arthouse allocation tests. The browser smoke harness may report `SKIP` in environments whose installed Chromium policy blocks local HTTP origins.

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

`content/curations/*.curation.json` is the Git-backed editorial source. Director Archive and Editorial Curation remain separate domain types. Director Archive definitions include static runtime snapshots so the public portfolio surface is not blank when live enrichment fails.

## Data sources

- TMDB: film metadata, images, recommendations and JustWatch-derived provider availability.
- KOBIS: Korean daily box office when configured.
- KINOSIS editorial files: Arthouse Director Archive / Editorial Curation definitions and snapshot fallbacks.

TMDB attribution is included in the product UI.
