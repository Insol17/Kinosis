# KINOSIS 0.4.5.8

**KINOSIS is a Korea-first Personal Film Library — 나만의 영화장.**

KINOSIS keeps discovery, Korean theatrical context, current viewing availability, a present-tense shelf, a separate watchlist, ratings/comments, viewing history and Collections around one Movie Entity. 0.4.5.8 moves more external data out of the user's critical path: KOBIS/TMDB are ingested into KINOSIS-owned snapshots, while Search/Detail remain user-driven network surfaces.

```text
DISCOVER  → KOBIS 기반 한국 박스오피스 / 개봉 예정 + 영화 발견
ARTHOUSE  → Curation / Director Archive 프로그램 탐색
DETAIL    → 작품 정보 / 감상 가능 / 현재 평가·기록
LIBRARY   → 현재 내 영화장 + 별도의 보고싶어요 + Collections
PROFILE   → 감상 기록 / 평가 / 한줄평 / cinematic calendar / 통계 / 설정
STUDIO    → admin only · Arthouse 프로그램 제작/미리보기/발행
```

## 0.4.5.8 focus

- **Availability provenance:** TMDB Watch Providers is treated as JustWatch-reported availability, not as a guaranteed real-time playback fact. Every row carries `source` + `confidence`.
- **Verified vs reported UI:** Detail separates `확인된 감상처` from `외부 DB · 확인 필요`. Watchlist/Discover no longer use unverified rows for strong `지금 볼 수 있음` claims.
- **Collectio official verification:** movie title + year are checked against Collectio's public official catalogue search. Exact matches are marked `collectio-official / verified` and can power `내 구독` availability.
- **Failure isolation:** Collectio verification is cached, bounded by timeout and non-fatal. A provider-site failure cannot erase other availability data or break Detail.
- **Verified correction merge:** the small emergency correction layer still exists for providers without a usable first-party source, but a verified row now upgrades a duplicate stale aggregator row rather than being dropped by deduplication.
- **Existing 0.4.5.7 watchlist utility, theatrical-state fix, visual Discover work, KOBIS snapshot, Studio and Arthouse contracts remain intact.**

See `PATCH-0.4.5.8.md`, `docs/API-SOURCES.md` and `docs/NETLIFY-DEPLOY.md`.

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
