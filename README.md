# KINOSIS 0.4.5.7

**KINOSIS is a Korea-first Personal Film Library — 나만의 영화장.**

KINOSIS keeps discovery, Korean theatrical context, current viewing availability, a present-tense shelf, a separate watchlist, ratings/comments, viewing history and Collections around one Movie Entity. 0.4.5.7 moves more external data out of the user's critical path: KOBIS/TMDB are ingested into KINOSIS-owned snapshots, while Search/Detail remain user-driven network surfaces.

```text
DISCOVER  → KOBIS 기반 한국 박스오피스 / 개봉 예정 + 영화 발견
ARTHOUSE  → Curation / Director Archive 프로그램 탐색
DETAIL    → 작품 정보 / 감상 가능 / 현재 평가·기록
LIBRARY   → 현재 내 영화장 + 별도의 보고싶어요 + Collections
PROFILE   → 감상 기록 / 평가 / 한줄평 / cinematic calendar / 통계 / 설정
STUDIO    → admin only · Arthouse 프로그램 제작/미리보기/발행
```

## 0.4.5.7 focus

- **Watchlist utility:** `보고싶어요` opens useful slices first (`지금 볼 수 있음`, `100분 안에 볼 수 있음`, `오래 기다린 영화`, `최근 담은 영화`) and keeps an explicit `전체 보기` for the exhaustive list.
- **Stable watchlist intent:** personal schema v9 stores `watchlistedAt` independently from later rating/comment edits.
- **Availability correctness:** a release date no longer means `상영 중`; only current KOBIS/TMDB evidence can produce a theatrical badge. Partial provider failures preserve last-known provider data.
- **Verified supplements:** a deliberately tiny timestamped correction layer can fill known JustWatch/TMDB gaps without turning KINOSIS into a second availability database. The 2026-08-20 Eureka correction includes WATCHA + YouTube and removes stale theatrical availability.
- **Discover Watch Now:** selected subscriptions are shown as landscape, still/backdrop-led cards rather than another poster/OTT-logo rail.
- **Genre browse:** Horror / Comedy / SF / Romance visual entry cards provide a deterministic exploration path without pretending to be personalized AI recommendation.
- **Existing 0.4.5.6 programme, KOBIS snapshot, Studio, cinematic calendar and trailer/still contracts remain intact.**

See `PATCH-0.4.5.7.md`, `docs/API-SOURCES.md` and `docs/NETLIFY-DEPLOY.md`.

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
