# KINOSIS 0.4.3.2

KINOSIS is a responsive film discovery and personal film-life web MVP.

```text
DISCOVER  → what should I watch?
ARTHOUSE  → what should I explore as cinema?
LIBRARY   → what have I saved and how do I manage it?
MY        → what has my film life looked like?
```

Search is global. Movie detail has a shareable URL. Library and MY require an account; guests can freely use Discover, Arthouse, Search and film detail.

## What changed in 0.4.3 / 0.4.3.2

- Shareable movie URLs and browser back/forward routing.
- Viewing logs can be edited and deleted.
- Rewatches are explicit events. Each viewing keeps its own date/rating/review; the Library rating represents the latest current opinion.
- MY is simplified to **Overview / Reviews / Stats / Settings**. Diary and Review are one viewing-history surface, while the calendar is embedded in Overview.
- Calendar days with multiple films open a complete day list instead of only the first film.
- Arthouse rows use smaller fixed-width poster cards and the weekly updater fetches more KR now-playing pages plus a broader director/canon seed pool.
- **For You** uses the user's highly-rated films as seeds for TMDB recommendation/similarity candidates.
- Similar Films uses live TMDB recommendations with a local fallback.
- Search supports movies, people and common genre queries; person results open their filmography.
- Watchlist availability is periodically rechecked and newly available subscription titles are surfaced in Library.
- Personal Collections now support descriptions, visual covers and explicit movie ordering.
- Letterboxd CSV import beta supports watched/ratings/diary/reviews/watchlist exports.
- Curation returns in 0.4.3.2 as **content-as-code**: no Admin account or Supabase editor. Files under `content/curations/{discover,arthouse,both}` are indexed automatically at Netlify build time.


## File-based Curation

Curation is intentionally separate from user Collections and from account permissions. The repository is the editorial CMS.

```text
content/curations/
├ discover/   → DISCOVER only
├ arthouse/   → ARTHOUSE only
└ both/       → both surfaces
```

Add a `*.curation.json` file, commit, and push. Netlify runs `npm run build`, validates the definitions, and generates `data/curations.js`. Curation pages receive shareable `?curation=<slug>` URLs and films outside the weekly 70-film cache are hydrated through the existing TMDB detail proxy.

See `content/curations/README.md`.

## Run

For shell/UI-only testing, `index.html` can still be opened directly. Live TMDB search and Netlify Functions require a served Netlify environment.

```bash
npm install -g netlify-cli
netlify login
netlify link
netlify dev
```

Production is expected to be deployed from GitHub to Netlify.

## Environment variables

GitHub Actions:

```text
TMDB_READ_ACCESS_TOKEN
```

Netlify:

```text
TMDB_READ_ACCESS_TOKEN
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
```

Do not put the TMDB token or a Supabase Secret/Service Role key in frontend JavaScript.

## Supabase

Fresh project: run `supabase/SETUP_ALL.sql` once in Supabase SQL Editor.

If the 0.4.1 core schema is already installed, **0.4.3 requires no additional DB migration**. `supabase/003_kinosis_043.sql` documents that fact.

The app uses:

- Supabase Auth with PKCE.
- one RLS-protected `user_state` JSON payload per account for the MVP.
- `app_health` for the lightweight external health request.

The old 0.4.2 curation SQL is retained only under `supabase/legacy/` for history and is not required.

## Data sources

- TMDB — movie metadata and imagery.
- JustWatch via TMDB Watch Providers — KR availability.

The product includes visible attribution and the required TMDB non-endorsement notice.

## Automatic catalog refresh

`.github/workflows/refresh-catalog.yml` runs the catalog updater. 0.4.3 fetches up to four pages of KR now-playing results and a broader Arthouse seed set before enriching the catalog. Failed validation leaves the last known-good catalog intact.

## Test

```bash
npm test
```

The suite checks the catalog, core UX surfaces, API contracts, Arthouse classifier, file-based curation index, and syntax of browser/Netlify modules.
