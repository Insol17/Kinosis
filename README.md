# KINOSIS 0.4.1 MVP

Movie discovery + account-synced personal film library for Netlify.

## What changed in 0.4.1

- **Account required for LIBRARY / MY**. Guests can browse DISCOVER and use global TMDB search, but Save / Log / Watchlist / Favorite / Collections require sign-in.
- **Supabase Auth** using Google, Kakao, or email magic-link UI.
- **Cross-device cloud sync** for Library, Diary, ratings/reviews, collections, subscriptions, cached movie snapshots and preferences.
- **Offline/local cache** remains on each signed-in device. Failed sync does not erase local work; reconnect triggers another sync attempt.
- **Legacy migration**: after first sign-in, 0.4.0-and-earlier local data can be imported into the account.
- **ART MODE**: same visual design, different DISCOVER lens. KINOSIS computes an explainable boolean classification from cinephile-canon title seeds, auteur/director seeds, keywords, production/distribution signals, and manual seed flags.
- **ART MODE is not an AI black box in 0.4.1**. The classifier is deterministic, free, inspectable, and replaceable later by embeddings/model inference if that proves useful.
- **ART Library filter**.
- **Supabase health scheduled function**: three external reads per day from Netlify to reduce inactivity risk and double as a database health check. This is not a contractual guarantee against Free-plan pausing.
- Existing **Netlify TMDB live search**, weekly GitHub Discover refresh, compact Library posters, PWA cache-busting, TMDB/JustWatch attribution and Collectio subscription entry remain.

## Architecture

```text
TMDB
 ├─ GitHub Actions -> weekly Discover catalog
 └─ Netlify Functions -> live movie search/detail

Supabase
 ├─ Auth (Google / Kakao / Email)
 └─ user_state JSONB row protected by RLS
        ↕
KINOSIS signed-in device cache

Guest
 └─ Discover + Search only
```

`user_state` is intentionally a single versioned JSONB snapshot for the MVP. It lets KINOSIS validate account gating and cross-device sync without prematurely creating a social-data schema. Public reviews/follows can later split this into normalized tables.

## Required one-time Supabase step

Run this file in **Supabase Dashboard -> SQL Editor**:

```text
supabase/001_kinosis_041.sql
```

It creates:

- `public.user_state` with per-user RLS
- `public.app_health` with a single non-sensitive read-only health row

Do **not** put a Supabase Secret key or `service_role` key in the browser.

The frontend currently uses the project's public configuration in `assets/js/config.js`:

- Supabase Project URL
- Supabase Publishable Key

Both are intended for client use when RLS is correctly configured.

## OAuth providers

The UI already contains Google and Kakao buttons. To make them work for other people, enable each provider in **Supabase -> Authentication -> Sign In / Providers** and add the provider credentials.

Additional provider-side settings still matter:

- Google: configure a Web OAuth client, the Supabase callback URL, allowed origins, and an External audience/publishing state suitable for your users.
- Kakao: enable Kakao Login, register the Supabase callback URL, activate the client secret, and configure consent items.

See `docs/SUPABASE-AUTH-SETUP.md`.

## ART MODE

0.4.1 does **not** call an LLM or embedding API. `assets/js/art-classifier.js` computes a feature score and returns an internal boolean.

Signals include:

- selected film-canon title seeds
- director/auteur seeds
- TMDB keywords
- production/distribution names
- classic-film heuristic
- `artSeed` emitted by the weekly updater
- future manual override support

The user sees only the inclusion reasons, not an “art score.”

The official KMDb article by Jung Sung-il, **[시네필 안내서]100편의 영화**, is used as a conceptual seed reference; KINOSIS does not reproduce article text or copy Watcha/Letterboxd datasets.

## Run

For static UI fallback:

```text
open index.html
```

Auth and Netlify Functions require HTTP/HTTPS. For real local development:

```bash
npm run dev
```

Production is the connected Netlify deployment.

## Tests

```bash
npm test
```

## Data source attribution

- TMDB — movie metadata and imagery
- JustWatch via TMDB Watch Providers — KR availability
- KINOSIS ART MODE — local deterministic classifier / curated seed rules
- Collectio — manual subscription preference only; no automatic availability scraping

The product UI includes the required TMDB notice and JustWatch attribution.
