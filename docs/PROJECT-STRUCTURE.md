# KINOSIS project structure — 0.4.6.6

The repository root is reserved for entry/configuration files. Release notes and audits do not belong in the root.

```text
KINOSIS/
├─ index.html                  # browser shell only
├─ assets/
│  ├─ css/                     # application styles
│  └─ js/
│     ├─ app.js                # composition root / view orchestration
│     ├─ core/                 # router, store, scheduler, performance, entity merge
│     ├─ domain/               # personal-state rules and commands; no DOM/network
│     ├─ infrastructure/       # API client + repositories
│     ├─ services/             # reusable async data loaders
│     ├─ features/             # surface-specific renderers/controllers
│     └─ ui/                   # reusable UI renderers
├─ content/curations/          # authored editorial/director programme definitions
├─ data/                       # generated/public runtime snapshots
├─ netlify/
│  ├─ functions/               # server-only public API boundary
│  └─ lib/                     # server-only API/evidence helpers
├─ shared/                     # build + server shared canonical policy/data
├─ scripts/                    # trusted build/ingest/migration utilities
├─ supabase/                   # schema/RLS migrations
├─ tests/                      # regression/contracts/browser smoke
└─ docs/
   ├─ releases/                # PATCH-*.md history
   ├─ audits/                  # architecture/performance audits
   └─ *.md                     # current architecture/deploy/source policy
```

## Boundary rules

- `domain/` must not access DOM or network.
- `infrastructure/` owns transport; feature code should use repositories rather than raw `fetch`.
- `features/` owns a surface-specific policy/renderer/controller. New surface behavior should not be added to `app.js` if it can be isolated here.
  - `features/collection-search.js` owns search/add interaction inside the Collection edit dialog; `collection-editor.js` owns add/remove/reorder mutations and the detail surface remains works-first.
  - `features/collection-editor.js` owns pure Collection add/remove/reorder mutations and has no DOM/network dependency.
  - `features/movie-search-index.js` owns reusable pre-indexed local movie lookup.
  - `features/discover-curation-carousel.js` owns Discover Curation spotlight selection/render/timing without network access.
- `app.js` remains the composition root. It may coordinate modules and cross-surface state, but should not become the permanent home of new render systems.
- Secrets stay in trusted build/functions environments. Public `assets/`, `data/`, and `index.html` must never contain TMDB/KOBIS/Supabase secret credentials.
- Generated snapshot data is replaced only after validation; user traffic must not invoke KOBIS.
