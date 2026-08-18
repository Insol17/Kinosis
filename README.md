# KINOSIS 0.4.4.3

KINOSIS is a responsive film discovery and personal film-life web MVP.

```text
DISCOVER  → box office / upcoming / my services / highly rated
ARTHOUSE  → recent / highly rated / KINOSIS curations
LIBRARY   → simple Steam-like personal film management
MY        → overview / reviews / stats / settings
```

Search is global. Film detail and curation pages have shareable URLs. Library and MY require an account; guests can browse Discover, Arthouse, Search and film detail.

## 0.4.4.3 focus

This is a stability and core-service pass rather than a social/features release.

- Fixed the Director Curation render/ensure loop. Cached Curation data now returns `changed:false`; a loaded curation rerenders only once after new data arrives.
- Cloud writes now use a Supabase revision RPC with per-user serialization and optimistic conflict detection instead of non-atomic read → merge → overwrite.
- `내 구독 서비스에서` now queries TMDB's KR provider catalog live rather than being limited to the weekly ~70-film Discover cache.
- Library is a result set: Log / 보고싶어요 / 좋아요 / Collection automatically establish the film relationship; the redundant direct `+ Library` action is gone.
- Added complete account deletion through an authenticated Netlify Function. The Supabase Secret Key stays server-only.
- Consolidated the 0.4.4.2 visual override layer into one `app.css`, fixed low-contrast secondary tokens and 44px pointer targets, and kept the Korean-first Pretendard system.
- Hero slides stay mounted and transition with opacity/transform instead of rebuilding the entire Hero DOM on every autoplay tick.
- Added explicit Netlify Function rate limits to public TMDB/KOBIS proxy endpoints.
- Arthouse editorial seeds moved out of classifier logic into `data/arthouse.js`.
- Added a global JS error fallback so unexpected runtime errors produce a user-facing recovery message rather than silently freezing.

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

Existing 0.4.x project: **run `supabase/004_kinosis_0443.sql` once**. It adds the `revision` column and `kinosis_write_user_state()` RPC used by 0.4.4.3 atomic sync.

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

The suite checks catalog integrity, static UX/security markers, TMDB/KOBIS Function contracts, live My Streaming, Arthouse classification, Curation build validation, the Curation no-rerender regression, and OTT canonical/logo behavior.
