# KINOSIS 0.4.4.1

KINOSIS is a responsive film discovery and personal film-life web MVP.

```text
DISCOVER  → mainstream discovery: box office / upcoming / my services / highly rated
ARTHOUSE  → editorial cinema discovery + KINOSIS curations
LIBRARY   → simple, dense personal film management
MY        → overview / reviews / stats / settings
```

Search is global. Film detail and curation pages have shareable URLs. Library and MY require an account; guests can browse Discover, Arthouse, Search and film detail.

## 0.4.4.1 focus

- Removed the offline/PWA shell and Service Worker. KINOSIS is an online-first web service; local storage remains only as a signed-in recovery/sync cache.
- Reduced navigation jank: only the active surface renders, live box-office refresh does not rebuild the Hero, and Arthouse no longer resolves four director filmographies on landing.
- Removed the unused hidden `For You` client loop and legacy Library Home/filter code.
- Added an exact KOBIS daily box-office Function. Without `KOBIS_API_KEY`, KINOSIS shows unranked `현재 상영작` instead of manufacturing a ranking from TMDB popularity.
- Hero banners are full-surface links to film detail and use lighter opacity/transform transitions.
- Film detail is rebuilt as a stronger information hub: masthead, rating/actions, synopsis/facts, cast, personal history, related films and an inline Where to Watch surface.
- Where to Watch consolidates duplicate provider variants (for example Netflix + ad tier) and includes a `극장 · 현재 상영 중` option when the film is in the current theatrical set.
- KR theatrical release dates are preferred when TMDB release-date data or KOBIS provides them.
- P0 data-integrity fixes: rewatch flags are recalculated chronologically; current Library rating is fully derived from viewing logs; complete Library-film removal and Collection deletion carry cloud tombstones.
- New editorial visual layer avoids expensive blur and adds restrained transitions/hover feedback while preserving reduced-motion behavior.

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
```

### GitHub Actions

```text
TMDB_READ_ACCESS_TOKEN
KOBIS_API_KEY                 # optional but recommended for the generated catalog
```

Do not put the TMDB token, KOBIS key, or any Supabase Secret/Service Role key in frontend JavaScript.

## Supabase

Fresh project: run `supabase/SETUP_ALL.sql` once in Supabase SQL Editor.

If the 0.4.1 core schema is already installed, 0.4.4.1 requires no additional DB migration.

The MVP uses Supabase Auth with PKCE and one RLS-protected `user_state` JSON payload per account. The browser cache is not an offline product mode; it is a local recovery/sync cache for the authenticated account.

## File-based Arthouse Curation

`content/curations/*.curation.json` is the editorial source. Git is the current CMS; no Admin account is required.

```json
{
  "slug": "kiarostami",
  "title": "그럼에도 삶은 계속된다: 키아로스타미 컬렉션",
  "source": { "type": "director", "name": "Abbas Kiarostami", "sort": "release_asc" }
}
```

Director filmographies resolve only when the user opens that curation; the Arthouse landing does not fire those network requests.

## Data sources

- TMDB — movie metadata, imagery, search, recommendations and KR watch-provider bridge.
- JustWatch via TMDB Watch Providers — streaming availability.
- KOBIS — exact Korean daily box-office ranking when configured.

Visible attribution and the required TMDB non-endorsement notice remain in the product.

## Test

```bash
npm test
```

The suite checks catalog integrity, static UX/regression markers, KOBIS/TMDB Function contracts, the Arthouse classifier and file-based curation build validation.
