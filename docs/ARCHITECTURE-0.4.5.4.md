# KINOSIS 0.4.5.4 Architecture Notes

## 1. Product invariant

KINOSIS remains a Korea-first Personal Film Library. External APIs are data sources, not UI prerequisites.

```text
External sources
KOBIS / TMDB
      ↓
Ingest / enrichment
      ↓
KINOSIS-owned snapshots
      ↓
Browser paints immediately
      ↓
User-driven live requests only where they add value
```

The browser should not reconstruct stable catalogue/programme pages from slow third-party calls on every visit.

## 2. Korean theatrical pipeline

KOBIS is canonical for Korean theatrical facts:

- daily box-office rank / audience
- Korean opening date
- upcoming Korean theatrical titles
- `movieCd`

TMDB is enrichment:

- poster / backdrop
- overview / popularity / rating
- global movie identity

`scripts/update-theatrical.mjs` performs scheduled ingest and writes:

```text
data/theatrical-kr.json
data/theatrical-kr.js
data/theatrical-kr.mjs
data/kobis-tmdb-map.json
```

The persistent map avoids fuzzy title matching on every refresh. Unmatched KOBIS movies stay in the snapshot as `externalOnly` rows; missing TMDB enrichment may not delete a valid Korean box-office/upcoming entry.

`/api/box-office` and `/api/upcoming` only project the committed snapshot. Browser refreshes therefore consume **zero normal KOBIS calls**.

## 3. Director Archive pipeline

A public Director Archive is snapshot content.

```text
Studio or build
  ↓
TMDB person/movie credits
  ↓
full checked snapshot
  ↓
commit / publish
  ↓
ARTHOUSE paints snapshot
```

`hydrate-director-snapshots.mjs` fills stable programme definitions during builds when the TMDB build secret is available. Public Arthouse no longer treats a low-priority live Director request as the normal way to obtain most content.

Live `/api/director-filmography` remains useful for:

- Studio manual refresh
- emergency recovery when a snapshot is actually absent

It is not the ordinary render path.

## 4. Request priorities

Live requests still use the shared scheduler:

- `HIGH`: Search and an opened Detail
- `MEDIUM`: visible missing metadata / bounded recovery
- `LOW`: prefetch and non-critical enrichment

Stable theatrical data and Director Archive filmographies bypass this competition because they are committed snapshots.

## 5. Studio boundary

Roles remain intentionally small:

```text
user
admin
```

Demo is a session mode, not a role.

Frontend visibility uses trusted `app_metadata.user_role`, while Supabase RLS independently enforces writes.

Studio loading policy:

1. Route immediately to Studio shell.
2. Fetch lightweight programme summaries only.
3. Fetch full `payload` lazily on edit/preview.
4. Save/archive patches local list immediately.
5. Public data may revalidate in the background.
6. Preview renders the draft object directly and must not mutate the published Curation registry.

`006_kinosis_0454.sql` adds summary columns (`title`, `description`) so list views do not download every Director snapshot payload.

## 6. Curation domain

The public Curation model is deliberately light:

```text
Curation
├ slug
├ title
├ description
├ heroMovieId?
├ orderMode: unordered | curated
└ movies[]
   ├ id
   └ note?          optional
```

Chapters are legacy input only. The build layer flattens them once. Curation does not get a separate font family or compulsory magazine composition.

Director Archive remains a different object: a single director + filmography snapshot.

## 7. Arthouse visual language

Shared with KINOSIS:

- same typography family
- same buttons
- same card primitives
- same accent system
- same spacing/grid tokens

Arthouse-only surface layer:

- very low-opacity film grain
- subtle emulsion/hairline scratches
- thin archive framing
- perforation-like dividers

These are atmosphere, not content. They must not cover body text or reproduce specific copyrighted movie scenes.

## 8. Rating state

Star UI owns two distinct values:

- committed rating: persisted user state
- preview rating: pointer-only visual state

Leaving the **whole component** clears preview and restores committed state. Hover may never fabricate a persisted rating visually after pointer exit.

## 9. Viewing calendar

Desktop is a cinematic monthly grid using horizontal backdrop/still imagery. A day representative is deterministic:

1. highest `ratingSnapshot`
2. otherwise current movie rating as fallback
3. rating tie → latest `createdAt`

`watchedAt` stores a date rather than clock time, so the tie-break is explicitly **latest recorded**, not an invented latest viewing time.

`외 N편` counts unique movies, not raw ViewingEvents. Mobile switches to a monthly agenda instead of compressing seven landscape cells.

## 10. Remaining debt

`app.js` remains a large composition/orchestration module. 0.4.5.4 deliberately prioritizes data determinism and user-facing latency over a wholesale framework rewrite. The next safe extractions remain Profile and Curation/Studio orchestration.
