# KINOSIS 0.4.4.6

KINOSIS is a responsive film discovery and personal film-life web MVP.

```text
DISCOVER  → box office / upcoming / my services / highly rated
ARTHOUSE  → recent / highly rated / KINOSIS curations
LIBRARY   → simple Steam-like personal film management
MY        → overview / reviews / stats / settings
```

Search is global. Film detail and curation pages have shareable URLs. Library and MY require an account; guests can browse Discover, Arthouse, Search and film detail.

## 0.4.4.6 focus

0.4.4.6 is a reliability patch on top of the 0.4.4.5 UX pass. The priority is that a saved film remains visible, a search result opens a usable Detail page quickly, and partial network failure degrades explicitly instead of producing blank cards or a global error toast.

- Fixed the Detail integration crash caused by an `isSignedIn` dependency contract mismatch.
- Detail navigation is immediate: a visible loading shell renders first, static film metadata follows, then Where to Watch and recommendations hydrate in the background.
- `/api/movie-detail` is the static critical path; `/api/movie-availability` owns volatile provider/theatrical state; `/api/movie-summaries` batch-hydrates personal records.
- Library/MY are ID-first. Missing movie metadata can show a loading placeholder but can no longer remove a saved movie/log from the screen.
- Cloud Sync includes compact stable snapshots only for films referenced by personal data, while volatile availability remains separately refreshed.
- `core/movie-entities.js` owns movie entity/snapshot rules and `services/movie-loader.js` owns request orchestration/in-flight de-duplication. Search and Detail remain isolated feature renderers.
- Loading skeletons, retry states and intentional poster fallbacks replace blank cards.
- The current architectural boundary and the staged `app.js` decomposition plan are documented in `docs/ARCHITECTURE-0.4.4.6.md`.

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
