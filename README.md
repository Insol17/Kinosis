# KINOSIS 0.4.4.4

KINOSIS is a responsive film discovery and personal film-life web MVP.

```text
DISCOVER  → box office / upcoming / my services / highly rated
ARTHOUSE  → recent / highly rated / KINOSIS curations
LIBRARY   → simple Steam-like personal film management
MY        → overview / reviews / stats / settings
```

Search is global. Film detail and curation pages have shareable URLs. Library and MY require an account; guests can browse Discover, Arthouse, Search and film detail.

## 0.4.4.4 focus

This release is a data-integrity and film-detail pass. It keeps the product IA stable while fixing the remaining sync race, duplicated movie identities, thin Upcoming data and the film-detail hierarchy.

- Film detail now follows the proven poster + title/meta + personal actions + synopsis/cast/credits + watch-availability grammar used by mature film services, while keeping KINOSIS's graphite/amber visual language and personal viewing-history emphasis.
- Dynamic Curation and Search results dedupe by both TMDB id and normalized original-title/year identity so one film does not appear several times under duplicate upstream records.
- Víctor Erice uses `mode: "solo-features"`: the director resolver keeps only feature-length movies for which Erice is the sole credited director. The four-film collection is therefore no longer polluted by shorts, anthology segments or duplicate credits.
- Cloud sync adds a client-side `localRevision` generation guard. A network write that finishes after the user made another local edit can no longer replace the live state with its older snapshot.
- Delete tombstones are merged by the latest timestamp per entity instead of source order.
- Replaceable TMDB movie metadata and availability snapshots are kept local rather than uploaded as user-authored Cloud state.
- Upcoming discovery uses a KR theatrical Discover query (`release_type 3|2`, next 120 days). When the weekly bundled catalog is too thin, `/api/upcoming` fills the rail live.
- Hero interaction uses proper carousel semantics, touch swipe, 44px controls and does not resume keyboard-stopped autoplay until the user explicitly restarts it.
- Provider and Arthouse editorial source data now live under `shared/` and generate browser data, avoiding separate hardcoded server/client lists.
- Letterboxd bulk matching respects the public search rate-limit budget and backs off on HTTP 429.

## OTT/provider identity

Provider identity is data-driven through `data/providers.js` and `assets/js/providers.js`.

- Provider variants are consolidated into canonical brands (for example Netflix + Netflix Standard with Ads).
- TMDB/JustWatch `logo_path` imagery is used for providers by default.
- WATCHA uses the official transparent WATCHA wordmark in `assets/branding/providers/watcha-logo-white.png` because the current upstream provider tile is not suitable as WATCHA branding in KINOSIS.
- Provider marks have transparent UI containers and `object-fit: contain`; KINOSIS does not add black icon tiles behind them.

## Run

For the full production-like environment use Netlify Dev:

```bash
netlify dev
```

Production is expected to deploy from GitHub to Netlify.

## Environment variables

### Netlify

```text
TMDB_READ_ACCESS_TOKEN
KOBIS_API_KEY                 # required for exact Korean daily box-office ranking
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY           # server-only; required only for account deletion
```

`SUPABASE_SECRET_KEY` must never be placed in `index.html`, `config.js`, frontend JavaScript, or a public GitHub secret dump.

### GitHub Actions

```text
TMDB_READ_ACCESS_TOKEN
KOBIS_API_KEY                 # optional but recommended for the generated catalog
```

## Supabase migration

Fresh project: run `supabase/SETUP_ALL.sql` once in Supabase SQL Editor.

Existing 0.4.x project: **run `supabase/004_kinosis_0443.sql` once**. It adds the `revision` column and `kinosis_write_user_state()` RPC used by the 0.4.4.x atomic sync layer.

The browser still uses only the Publishable Key and RLS. The server-only Secret Key is used solely by `/api/delete-account` after validating the signed-in user's access token.

## File-based Arthouse Curation

`content/curations/*.curation.json` is the editorial source. Git is the current CMS; no Admin account is required.

```json
{
  "slug": "kiarostami",
  "title": "그럼에도 삶은 계속된다: 키아로스타미 컬렉션",
  "source": { "type": "director", "name": "Abbas Kiarostami", "sort": "release_asc" }
}
```

Director filmographies resolve only when the user opens that curation; the Arthouse landing does not preload all four filmographies.

## Data sources

- TMDB — movie metadata, imagery, search, recommendations, KR now-playing and watch-provider bridge.
- JustWatch via TMDB Watch Providers — streaming availability/provider data.
- KOBIS — exact Korean daily box-office ranking when configured.
- WATCHA official media kit — WATCHA brand wordmark override.

Visible attribution and the required TMDB non-endorsement notice remain in the product.

## Test

```bash
npm test
```

The suite checks catalog/rail integrity, static UX/security markers, TMDB/KOBIS Function contracts, live My Streaming/Upcoming, Arthouse classification, Curation build validation, duplicate movie collapse, the Curation no-rerender regression, OTT canonical/logo behavior and Cloud state-integrity helpers.
