# KINOSIS 0.4.5.4

**KINOSIS is a Korea-first Personal Film Library — 나만의 영화장.**

KINOSIS keeps discovery, Korean theatrical context, current viewing availability, a present-tense shelf, a separate watchlist, ratings/comments, viewing history and Collections around one Movie Entity. 0.4.5.4 moves more external data out of the user's critical path: KOBIS/TMDB are ingested into KINOSIS-owned snapshots, while Search/Detail remain user-driven network surfaces.

```text
DISCOVER  → KOBIS 기반 한국 박스오피스 / 개봉 예정 + 영화 발견
ARTHOUSE  → Curation / Director Archive 프로그램 탐색
DETAIL    → 작품 정보 / 감상 가능 / 현재 평가·기록
LIBRARY   → 현재 내 영화장 + 별도의 보고싶어요 + Collections
PROFILE   → 감상 기록 / 평가 / 한줄평 / cinematic calendar / 통계 / 설정
STUDIO    → admin only · Arthouse 프로그램 제작/미리보기/발행
```

## 0.4.5.4 focus

- **Snapshot-first theatrical data:** KOBIS is the canonical source for Korean box office and Korean opening/upcoming data. A scheduled ingest enriches KOBIS rows with TMDB imagery/metadata and writes `data/theatrical-kr.*`; browser refreshes read the snapshot and do **not** consume KOBIS quota.
- **Persistent KOBIS↔TMDB identity mapping:** `data/kobis-tmdb-map.json` remembers resolved pairs. A KOBIS movie remains visible even when TMDB matching fails; only enrichment is missing.
- **Arthouse no longer depends on runtime filmography assembly:** Director Archive snapshots are hydrated at build/authoring time. Public Arthouse paints committed snapshots immediately; live Director requests are recovery only when a snapshot is missing.
- **Studio responsiveness:** Studio routes immediately to a loading shell, fetches a lightweight programme list, lazily loads full payloads on edit/preview, patches local state after save/archive, and no longer mutates the global published Curation registry for preview.
- **Curation as a film collection object:** default Curation grammar is `title + short description + films`. Per-film notes are optional, ordering is optional (`unordered` / `curated`), and legacy chapters are flattened at the build boundary.
- **One typography system, differentiated Arthouse surface:** no special editorial font. Arthouse uses the same KINOSIS components with restrained grain, emulsion scratches, thin archive framing and perforation-like rules.
- **Rating preview correctness:** pointer hover is transient; leaving the whole rating control restores the committed value instead of leaving an uncommitted 4.5-star visual state.
- **Cinematic viewing calendar:** desktop cells use horizontal still/backdrop imagery. The representative film is the highest-rated viewing event, with latest-recorded as the tie-break; multiple films are summarized as `외 N편` using unique movies. Mobile switches to a readable monthly agenda.
- **Bounded external work:** Search/Detail keep foreground priority, snapshot hydration is background work, Director refresh is no longer an ordinary public-page requirement, and legacy `/movie-summaries` remains recovery-only.

See `docs/ARCHITECTURE-0.4.5.4.md`, `docs/API-SOURCES.md`, `docs/NETLIFY-DEPLOY.md` and `PATCH-0.4.5.4.md`.

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

- **Curation:** a film collection with a short context. Ordering and film notes are optional.
- **Director Archive:** a filmography surface backed by a committed snapshot. Studio/build refresh is responsible for updating it; public rendering is not.

## Data sources

- **KOBIS:** canonical Korean box office and Korean theatrical opening/upcoming facts.
- **TMDB:** poster/backdrop, metadata, credits, recommendations and JustWatch-derived provider availability.
- **KINOSIS snapshots:** browser-facing theatrical and Director Archive data.
- **KINOSIS editorial data:** Curation and Director Archive programme definitions.

TMDB attribution is included in the product UI.
