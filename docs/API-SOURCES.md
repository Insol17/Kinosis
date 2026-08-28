# KINOSIS API and snapshot policy — 0.4.6.6

## Principle

External APIs are **ingest/enrichment sources**, not page-render prerequisites. The browser should paint KINOSIS snapshots immediately and request live data only for user-driven detail/search flows.

## KOBIS — canonical Korean theatrical source

KOBIS is the canonical source for:

- Korean daily box-office rank.
- Korean theatrical opening dates used by `공개 예정작`.
- Stable `movieCd` identity for Korean theatrical records.

`KOBIS_API_KEY` is server/build-only. Do not put it in `index.html`, `config.js`, client JavaScript, screenshots or public source.

### Quota policy

Browser refreshes do **not** call KOBIS. Netlify builds refresh the snapshot when both build secrets are available, and `.github/workflows/refresh-theatrical.yml` also runs once per day. Both paths generate:

- `data/theatrical-kr.json`
- `data/theatrical-kr.js`
- `data/theatrical-kr.mjs`
- `data/kobis-tmdb-map.json`

KOBIS use is tied to scheduled/build ingestion rather than page views, so a normal day consumes only a small fixed number of KOBIS calls regardless of whether 10 or 10,000 users open Discover. The public `/api/box-office` and `/api/upcoming` endpoints serve the generated snapshot and do not consume the KOBIS key.

### KOBIS ↔ TMDB identity

KOBIS `movieCd` is mapped once to a TMDB ID and persisted in `data/kobis-tmdb-map.json`. KOBIS remains canonical for theatrical rank/date; TMDB enriches posters, backdrops and metadata. A TMDB match failure must not erase the KOBIS row: unmatched rows remain visible as non-detail KOBIS records until a mapping is resolved.

## TMDB

TMDB remains the source for:

- Posters/backdrops.
- Search and movie detail.
- Credits and director filmography ingestion.
- Recommendations.
- Watch Providers / JustWatch availability.

`TMDB_READ_ACCESS_TOKEN` is trusted-runtime only.

## Director Archive

Authored Director Archives remain the canonical editorial objects. Studio/admin chooses the exact films that belong in those Archives; KINOSIS never auto-publishes a director's complete raw credit list. During trusted builds, `build-curations.mjs` enriches selected TMDB IDs with compact title/poster/backdrop/director snapshots.

The larger Director Directory is an exploration index. If a director has no authored Archive, opening the portrait can create a temporary runtime entry point using `person + movie_credits` and a bounded representative-feature ranking. This runtime path deliberately avoids per-candidate movie-detail fan-out. It is a navigation aid, not an editorially verified canon; exact Archive membership should still be authored in Studio.

Director portrait metadata is loaded only as cards approach the viewport and is batched through `/api/director-profiles`; its Function/CDN response is cached. A future trusted build-time person/profile snapshot is preferred if public traffic grows enough that cold name-search cost matters.

`scripts/hydrate-director-snapshots.mjs` remains only as a legacy migration utility and is not part of the normal build path.

## Availability evidence model

Availability is volatile and remains a background/live enrichment layer. It never blocks the base movie page. A Korean theatrical release date is treated only as historical metadata; the UI shows `상영 중` only when current KOBIS/TMDB evidence exists.

### TMDB Watch Providers / JustWatch — reported evidence

TMDB Watch Providers is powered by JustWatch. KINOSIS stores those rows as `source: tmdb-justwatch` and `confidence: reported`. They are useful discovery candidates, but KINOSIS must not present them as a directly verified real-time playback fact. The Detail surface therefore separates these rows under `외부 DB · 확인 필요`; they do not by themselves satisfy the watchlist/Discover `지금 볼 수 있음` predicate.

### Collectio — daily homepage snapshot + exact official search fallback

Collectio does not currently flow through TMDB's Korean provider list reliably enough for KINOSIS. A scheduled GitHub Action runs `scripts/update-collectio.mjs` once per day and parses the public Collectio homepage into `data/collectio-kr.{json,mjs}`. This committed snapshot is deliberately labeled `scope: homepage`: it is a low-cost cache of the catalogue surface visible on the homepage, **not** a claim that KINOSIS has mirrored Collectio's complete catalogue.

`netlify/lib/collectio.mjs` checks that snapshot first using exact normalized title + release-year matching. A snapshot hit becomes `source: collectio-official`, `confidence: verified` with the official page URL and snapshot timestamp. If the film is not present in the homepage snapshot, KINOSIS falls back to the existing bounded title search against Collectio's public official site; those searches retain the 12-hour cache and short timeout.

The scheduled updater uses generate → validate → replace semantics: a network error or parser returning zero rows fails the job and leaves the last known-good committed snapshot untouched. If Collectio changes its markup, both snapshot and live parser therefore fail closed rather than converting absence into a false `not available` assertion.

### Manual verified supplements

Providers without a reliable first-party catalogue surface can still require a small timestamped correction in `shared/availability-overrides.mjs`. This file is an emergency evidence supplement, not a shadow OTT database. Verified corrections may upgrade an identical stale aggregator row; they must not silently create broad catalogue claims.

Long term, the preferred order is: first-party provider API/feed → bounded official-site verifier → licensed partner availability feed → TMDB/JustWatch reported candidate.

## Failure policy

- Snapshot refresh: generate → validate → replace; failure retains last known-good committed data.
- KOBIS/TMDB matching failure: keep KOBIS title/rank/date and omit detail navigation until mapped.
- Programme enrichment failure: keep the explicitly selected IDs and any last known programme snapshots; never change programme membership.
- Search/detail failure: preserve the existing MovieSummary and show a local retry state.
- Personal data: keep compact movie snapshots in cloud state so Library/Profile do not depend on Discover catalog membership.
