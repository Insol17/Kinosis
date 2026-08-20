# KINOSIS API and snapshot policy — 0.4.5.6

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

Director Archives are explicitly authored programmes. Studio/admin chooses the exact films that belong in each Archive; KINOSIS never auto-publishes a director's complete filmography. During trusted builds, `build-curations.mjs` enriches only those selected TMDB IDs with compact title/poster/backdrop/director snapshots. Public Arthouse renders those committed selections first and never needs a runtime director-filmography query.

`scripts/hydrate-director-snapshots.mjs` remains only as a legacy migration utility and is not part of the normal build path.

## JustWatch via TMDB Watch Providers

Availability is volatile and remains a background/live enrichment layer. It never blocks the base movie page.

## Failure policy

- Snapshot refresh: generate → validate → replace; failure retains last known-good committed data.
- KOBIS/TMDB matching failure: keep KOBIS title/rank/date and omit detail navigation until mapped.
- Programme enrichment failure: keep the explicitly selected IDs and any last known programme snapshots; never change programme membership.
- Search/detail failure: preserve the existing MovieSummary and show a local retry state.
- Personal data: keep compact movie snapshots in cloud state so Library/Profile do not depend on Discover catalog membership.
