# KINOSIS 0.4.6.6

**KINOSIS is a Korea-first Personal Film Library — 나만의 영화장.**

KINOSIS keeps discovery, Korean theatrical context, current viewing availability, a present-tense shelf, a separate watchlist, ratings/comments, viewing history and Collections around one Movie Entity. 0.4.6.6 tightens the film-first Library/Collection flow, restores clearer Discover card grammar and keeps Arthouse's moving Curation Hero while giving the archive a restrained editorial identity.

```text
DISCOVER  → KOBIS 기반 한국 박스오피스 / 개봉 예정 + 영화 발견
ARTHOUSE  → Curation / Director Archive 프로그램 탐색
DETAIL    → 작품 정보 / 감상 가능 / 현재 평가·기록
LIBRARY   → 현재 내 영화장 + 별도의 보고싶어요 + Collections
PROFILE   → 감상 기록 / 평가 / 리뷰 / cinematic calendar / 통계 / 설정
STUDIO    → admin only · Arthouse 프로그램 제작/미리보기/발행
```

## 0.4.6.6 focus

- **Watch Now matches movie discovery:** verified streaming titles now reuse the same poster-card grammar as Box Office, with contextual OTT marks as a lightweight overlay instead of landscape promo cards.
- **Genre stays wide:** Discover keeps the horizontal genre language in both preview and the expanded 18-genre directory.
- **Box Office stays a rail:** no redundant full-view route; the rail accepts up to 30 genuine ranked rows when the source provides them, without inventing ranks.
- **Collection is works-first:** Collection detail is a dense seven-column Library-sized film grid with a compact header; searching/adding/removing films lives inside Edit, where changes are staged until Save.
- **Stable Arthouse navigation:** the desktop hover menu closes when hover/focus leaves, while subtle warm hairlines, restrained saturation and squarer programme surfaces distinguish Arthouse without decorative numbering.
- **Safer controls:** Hero navigation has a reserved content gutter so previous/next arrows never cover programme copy.
- **Provider marks:** movie-scoped TMDB/JustWatch provider artwork takes precedence over tiny first-party favicons; first-party marks remain fallback only.

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

`npm test` includes generated-data validation, `checkJs` type checking, function/domain/runtime regression tests, Studio/performance contracts, calendar policy and snapshot contracts. The browser smoke harness may report `SKIP` in environments whose installed Chromium policy blocks local HTTP origins.

## Environment variables

### Netlify

Set these as secrets. `TMDB_READ_ACCESS_TOKEN` should be available to **Builds + Functions**; `KOBIS_API_KEY` is needed by scheduled/build ingest, never frontend code.

```text
TMDB_READ_ACCESS_TOKEN
KOBIS_API_KEY
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY
```

`SUPABASE_SECRET_KEY`, TMDB token and KOBIS key must never ship in frontend assets.

### GitHub Actions

For scheduled snapshot refresh add repository Actions secrets:

```text
TMDB_READ_ACCESS_TOKEN
KOBIS_API_KEY
```

`.github/workflows/refresh-theatrical.yml` refreshes the Korean theatrical snapshot daily. User traffic does not call KOBIS.

## Supabase

Fresh project: run `supabase/SETUP_ALL.sql`.

Existing 0.4.5.3 deployments additionally run:

```text
supabase/006_kinosis_0454.sql
```

Studio role remains intentionally small: normal `user` and trusted `admin`. Assign admin to the intended Auth UUID through `raw_app_meta_data` / `app_metadata`, then sign out/in to obtain a refreshed JWT.

## Editorial source

`content/curations/*.curation.json` remains the Git-backed portfolio fallback. Admin accounts can author dynamic overlays in **KINOSIS STUDIO**. Published rows override the same slug; Archived rows suppress a fallback without destructively deleting it.

- **Curation:** an explicitly selected film programme. Every film carries a curator explanation; ordering can be meaningful.
- **Director Archive:** an explicitly selected set of films by one director. Studio decides which works belong; runtime auto-filmography does not.

## Data sources

- **KOBIS:** canonical Korean box office and Korean theatrical opening/upcoming facts.
- **TMDB:** poster/backdrop, metadata, credits, recommendations and JustWatch-derived provider availability.
- **KINOSIS snapshots:** browser-facing theatrical and Director Archive data.
- **KINOSIS editorial data:** Curation and Director Archive programme definitions.

TMDB attribution is included in the product UI.
