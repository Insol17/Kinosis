# KINOSIS 0.4.5.6

**KINOSIS is a Korea-first Personal Film Library — 나만의 영화장.**

KINOSIS keeps discovery, Korean theatrical context, current viewing availability, a present-tense shelf, a separate watchlist, ratings/comments, viewing history and Collections around one Movie Entity. 0.4.5.6 moves more external data out of the user's critical path: KOBIS/TMDB are ingested into KINOSIS-owned snapshots, while Search/Detail remain user-driven network surfaces.

```text
DISCOVER  → KOBIS 기반 한국 박스오피스 / 개봉 예정 + 영화 발견
ARTHOUSE  → Curation / Director Archive 프로그램 탐색
DETAIL    → 작품 정보 / 감상 가능 / 현재 평가·기록
LIBRARY   → 현재 내 영화장 + 별도의 보고싶어요 + Collections
PROFILE   → 감상 기록 / 평가 / 한줄평 / cinematic calendar / 통계 / 설정
STUDIO    → admin only · Arthouse 프로그램 제작/미리보기/발행
```

## 0.4.5.6 focus

- **Authored programmes:** Director Archives and Editorial Curations are both explicitly selected in Studio. Archive has no required per-film commentary; Curation requires it.
- **Programme snapshots:** selected movie summaries are enriched during build when a TMDB token exists, and Studio stores compact snapshots with its selected films. Public Arthouse therefore renders from committed programme data first.
- **Discover composition:** movie-only Hero; Curation appears as a dedicated inline programme promotion. KOBIS ranking is factual and rank #1 is never removed by presentation dedupe.
- **Stable browsing:** horizontal rail arrows disappear at their true bounds; cards expose personal rating/watched state and no longer carry OTT logos.
- **Library/Profile polish:** oversized Library intro removed, Shelf/Watchlist use a stable header, Profile uses a compact record-first composition, and the cinematic calendar is retained.
- **Curation experience:** `그럼에도 삶은 계속된다` is a six-film cross-director programme with a required explanation beside each film. Programme pages can be saved as personal Collections.
- **Studio authoring:** richer film identity search and explicit Hero image selection from representative-film imagery.
- **Film Detail media:** trailers and stills load independently after the base Detail, keeping movie information and personal records usable first.
- **Visual identity:** a stronger but consistent Arthouse film/archive surface plus a new film-frame KINOSIS icon.

See `PATCH-0.4.5.6.md`, `docs/API-SOURCES.md` and `docs/NETLIFY-DEPLOY.md`.

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
