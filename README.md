# KINOSIS 0.4.4.7

KINOSIS is a Korea-focused responsive film discovery and personal film-life web MVP.

```text
DISCOVER  → box office / upcoming / my services / highly rated
ARTHOUSE  → Director Archive + Editorial Curation programme rails
LIBRARY   → fast retrieval / watchlist / favorites / personal collections
MY        → overview / viewing record / one-line-comment archive / stats / settings
```

Search is global. Film detail and curation pages have shareable URLs. Library and MY require an account; guests can browse Discover, Arthouse, Search and film detail.

## 0.4.4.7 focus

0.4.4.7 moves KINOSIS from a feature-first MVP toward a defined film-life model and a faster critical path. The release keeps the product Korea-first and does not add country selection, social feed, AI recommendations or new Discover shelves.

- **Fast Detail:** the known movie entity paints immediately; metadata, availability and recommendations hydrate concurrently and patch only their own regions. Search hover/focus can prefetch Detail.
- **Personal model v7:** LibraryMembership, FilmRelationship and ViewingEvent are separate. A current rating/comment is not the same thing as an individual viewing event.
- **Non-destructive Library removal:** removing membership does not erase ratings, one-line comments or viewing history. Full deletion is a separate confirmed action.
- **Watcha-like relationship input:** five visible stars, 0.5-step rating, prominent current one-line comment and a distinct per-viewing note.
- **MY archive:** current one-line comments can be reviewed as a drill-down from MY rather than becoming a new top-level category.
- **Collectio-like Arthouse presentation:** archives and editorial programmes appear as horizontal rails; editorial detail supports introductions, chapters and film notes.
- **Explicit architecture:** critical Search/Detail/entity/network paths use native ES modules with domain, infrastructure and service boundaries. JavaScript `checkJs` type checking is part of `npm test`.
- Architecture and ownership invariants are documented in `docs/ARCHITECTURE-0.4.4.7.md`.

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

The suite runs the curation/runtime build, `checkJs` type checking, syntax checks, catalog/API contracts, personal-state migration/command tests, architectural dependency checks, loader de-duplication/race regressions, provider normalization and Cloud state-integrity tests.

An optional real-Chromium smoke harness exercises Search → optimistic Detail → rating/comment → viewing event → non-destructive Library removal → MY archive → reload → Editorial Curation without adding a browser-test framework dependency:

```bash
npm run test:browser
```

The harness reports `SKIP` when the installed Chromium is managed by a policy that blocks local HTTP test origins.
