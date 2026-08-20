# KINOSIS 0.4.5.3 Architecture Notes

## 1. Product boundary

KINOSIS remains a Personal Film Library. Studio is an internal authoring surface, not a fifth public product category.

```text
PUBLIC
Discover / Arthouse / Detail / Library / Profile

ADMIN ONLY
KINOSIS Studio
```

The public UI never needs to understand how a curation is authored.

## 2. Role model

There are only two account roles:

```text
user   → normal product
admin  → normal product + Studio
```

Demo is not a role. It is a session-only local mode with Cloud reads/writes disabled.

The browser checks `user.app_metadata.user_role === "admin"` only to expose the Studio affordance. This is not the security boundary. `supabase/005_kinosis_0453.sql` repeats authorization in RLS for SELECT/INSERT/UPDATE/DELETE. A user-controlled `user_metadata` field never grants admin access.

## 3. Editorial domain

Static Git definitions remain the portfolio-safe fallback. Studio rows are dynamic overlays.

```text
Git curation fallback
       +
Published Studio rows
       +
Archived slug tombstones
       ↓
KINOSIS_CURATIONS_API
       ↓
Arthouse / Curation Detail
```

Programme lifecycle:

```text
Draft → Published → Archived
```

Archived is reversible storage, not destructive deletion.

Editorial and Director Archive have different authoring models:

```text
Editorial
short intro + ordered Movie IDs + short notes

Director Archive
stable TMDB personId + static filmography snapshot + optional live refresh
```

## 4. Movie data hierarchy

A usable screen must not depend on the slowest network response.

```text
MovieSummary       title/year/poster/backdrop/director
MovieMetadata      runtime/genres/cast/credits/overview
MovieAvailability  providers/theatrical state
```

Personal/cloud snapshots provide MovieSummary first. Metadata and Availability enrich that entity later. Lightweight responses may not erase already-enriched fields.

## 5. Network scheduling

`core/request-scheduler.js` is the single browser concurrency authority.

```text
HIGH    Search / opened Detail
MEDIUM  visible summary hydration / availability
LOW     prefetch / recommendations / Director refresh
```

Global cap is five requests. MEDIUM is capped at three and LOW at two, deliberately leaving foreground capacity free.

Key budgets:

- browser Detail: 8s;
- browser Search: 7s;
- browser Availability: 7.5s;
- browser Summary recovery: 8s;
- TMDB upstream: 6.5s;
- Detail slow-state feedback: 3.5s.

An upstream failure degrades only the affected surface. Known title/poster/personal records remain visible.

## 6. Summary recovery

`/api/movie-summaries` is not the normal Library bootstrap. It exists for legacy or incomplete snapshots.

- max 6 IDs per server call;
- one bounded upstream wave;
- max 2 client chunk workers;
- partial per-film failure;
- durable CDN cache.

This removes the old 20-ID / multi-wave path whose server work could outlive the client timeout.

## 7. Director Archive runtime policy

Director Archive uses **content first, network enrichment second**.

```text
snapshot paint
  ↓
if snapshot < 30 days old → stop
if stale/manual retry     → LOW priority live refresh
```

`solo-features` authoring uses one `/movie/{id}?append_to_response=credits` call per candidate, not separate detail and credits calls.

## 8. Curation presentation

Arthouse is not a separate magazine product. It shares KINOSIS typography, buttons, cards, spacing tokens and accent color.

Editorial public grammar:

```text
Title
Short introduction
01 Movie + short note
02 Movie + short note
03 Movie + short note
...
```

Director Archive uses compact decade groupings. Legacy chapter data is accepted by the runtime for compatibility but flattened; Studio does not author new chapters.

Arthouse distinction is a low-noise surface layer: grain/dust, thin frame and perforation-inspired lines. Decoration never covers body copy and does not create a second typography system.

## 9. Remaining debt

`app.js` remains the largest orchestration module. 0.4.5.3 keeps the performance and authoring boundaries outside it, but a later cleanup should extract Profile and Curation orchestration incrementally. A wholesale framework rewrite is still unnecessary.
