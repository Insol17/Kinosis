# KINOSIS 0.4.5.3

**KINOSIS is a Korea-first Personal Film Library — 나만의 영화장.**

It brings discovery, current viewing availability, a present-tense shelf, a separate watchlist, ratings/comments, viewing history and Collections together around one Movie Entity. 0.4.5.3 keeps that public product intact while adding a hidden admin-only Editorial Studio and making external movie data an enrichment layer rather than a prerequisite for a usable screen.

```text
DISCOVER  → 넓고 빠른 영화 발견
ARTHOUSE  → 큐레이션 / 감독 아카이브 기반의 프로그램 탐색
DETAIL    → 작품 정보 / 감상 가능 / 현재 평가·기록
LIBRARY   → 현재 내 영화장 + 별도의 보고싶어요 + Collections
PROFILE   → 감상 기록 / 평가 / 한줄평 / 캘린더 / 통계 / 설정
STUDIO    → admin only · Arthouse 프로그램 제작/미리보기/발행
```

## 0.4.5.3 focus

- **Foreground-first movie loading:** a global request scheduler gives Search/Detail priority and caps background prefetch/archive work. Detail has an 8-second hard request budget and exposes a slow partial state after 3.5 seconds instead of leaving the whole page in indefinite loading.
- **Summary recovery, not summary dependency:** personal MovieSummary snapshots paint first. `/api/movie-summaries` is limited to six IDs per request, two client workers and durable CDN caching for legacy/missing metadata recovery.
- **Director Archive snapshot policy:** fresh snapshots are served without a live refresh on every visit. Stale/manual refresh uses a bounded low-priority request, and `solo-features` performs one detail+credits upstream call per candidate instead of two.
- **Admin-only KINOSIS Studio:** only accounts whose trusted Supabase `app_metadata.user_role` is `admin` see Studio. Database RLS independently enforces authoring rights. Studio supports Editorial/Director Archive authoring, preview, Draft/Published/Archived lifecycle, TMDB movie lookup, ordering and archive snapshots.
- **Curation grammar simplified:** the default Editorial format is a short introduction + ordered films + short film notes. The public page no longer forces magazine-style chapters. Director Archive stays a compact filmography surface.
- **One typography system:** Discover, Arthouse, Curation, Library and Profile share the same font family and UI primitives. Arthouse distinction comes from a restrained film/archive surface layer—grain, thin frame and perforation motifs—not a second type system.
- **Regression protection:** new tests cover admin claim trust, RLS policy presence, Studio authoring grammar, request-priority capacity, summary batch bounds, fresh-snapshot TTL and the single-request Director solo-feature path.

See `docs/ARCHITECTURE-0.4.5.3.md` and `PATCH-0.4.5.3.md`.

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

Fresh project: run `supabase/SETUP_ALL.sql`. Existing 0.4.5.2 deployments additionally run `supabase/005_kinosis_0453.sql` for Studio. Assign admin only to the intended auth UUID via trusted `raw_app_meta_data` / `app_metadata`; normal users need no role row.

## Editorial source

`content/curations/*.curation.json` remains the Git-backed portfolio fallback. Admin accounts can author overlays in **KINOSIS STUDIO**; Published rows override the same slug, while Archived rows suppress a fallback without destructively deleting it. Director Archive and Editorial Curation remain separate domain types, and Director Archives keep static snapshots so the public surface is not blank when live enrichment fails.

## Data sources

- TMDB: film metadata, images, recommendations and JustWatch-derived provider availability.
- KOBIS: Korean daily box office when configured.
- KINOSIS editorial files: Arthouse Director Archive / Editorial Curation definitions and snapshot fallbacks.

TMDB attribution is included in the product UI.
