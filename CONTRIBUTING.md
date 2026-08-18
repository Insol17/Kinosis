# Contributing to KINOSIS

KINOSIS is still an MVP. Keep changes small and verifiable.

1. Run `npm test` before pushing.
2. Do not commit API tokens, Supabase keys with privileged roles, or user exports.
3. Keep `index.html` directly usable from `file://` for UI smoke testing.
4. Do not add a new film-data source until its API terms, attribution, cache policy, and failure behavior are documented in `docs/API-SOURCES.md`.
5. Preserve export/import compatibility when changing the local user-state schema.
