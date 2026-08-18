# KINOSIS 0.4.4.2

KINOSIS is a responsive film discovery and personal film-life web MVP.

```text
DISCOVER  → mainstream discovery: box office / upcoming / my services / highly rated
ARTHOUSE  → editorial cinema discovery + KINOSIS curations
LIBRARY   → simple, dense personal film management
MY        → overview / reviews / stats / settings
```

Search is global. Film detail and curation pages have shareable URLs. Library and MY require an account; guests can browse Discover, Arthouse, Search and film detail.

## 0.4.4.2 focus

- Design-only major pass while preserving the existing product IA and screen layouts.
- One Pretendard-based Korean-first font system; no serif/sans mixing in the active interface.
- Readable Korean sizing and line-breaking: larger metadata/body text, `word-break: keep-all`, and less microcopy.
- New transparent-background KINOSIS brand icon and a rebuilt rounded-stroke inline icon set.
- Icon controls are transparent by default instead of black pills/squares.
- Hero, poster rails, Library, MY, film detail and curation pages share the same graphite/amber visual grammar.
- Film detail is visually flattened into one continuous information page instead of stacked dashboard cards.
- Removed stale `recommender.js` loading and replaced the obsolete 0.4.4.1 visual layer with `assets/css/design-0442.css`.
- Functional behavior, routing, cloud sync, KOBIS/TMDB integrations and the four Arthouse curations are unchanged.

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

If the 0.4.1 core schema is already installed, 0.4.4.2 requires no additional DB migration.

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
