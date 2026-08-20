# KINOSIS 0.4.5.4

## Snapshot-first data pass

- KOBIS is now the canonical Korean theatrical source for box office and upcoming opening data.
- Added scheduled `scripts/update-theatrical.mjs` ingest and `refresh-theatrical.yml`.
- Added persistent KOBIS `movieCd` ↔ TMDB ID mapping.
- Browser/API projection reads `data/theatrical-kr.*`; normal user refresh no longer calls KOBIS.
- TMDB matching failure keeps the KOBIS row instead of deleting a ranked/opening movie.
- Director Archive build hydration fills committed snapshots; public Arthouse uses snapshot-first rendering.

## Studio responsiveness

- Studio route now paints immediately before Supabase reads finish.
- List reads lightweight columns; full payload is lazy on edit/preview.
- Save/archive update local state without blocking double-refetch.
- Director snapshot sync exposes progress.
- Draft preview no longer mutates the global published Curation registry.
- Added Supabase migration `006_kinosis_0454.sql` for list summary columns.

## Curation / Arthouse

- Curation simplified to short description + films; notes and ordering are optional.
- Legacy chapters flatten at build time.
- Arthouse Curation index uses collection/programme cards; Director Archive stays a rail/filmography surface.
- Same typography system across KINOSIS; Arthouse differentiation uses restrained film/archive surface texture only.

## Interaction fixes

- Star hover is transient and restores the persisted value when leaving the whole rating control.
- Viewing calendar redesigned around horizontal stills.
- Multi-film day representative = highest rating, tie = latest recorded event.
- `외 N편` uses unique films.
- Mobile calendar uses agenda rows.

## Performance policy

- Stable theatrical and Director programme content is removed from normal runtime external-API dependency.
- Search/Detail retain foreground request priority.
- `/movie-summaries` remains bounded recovery for missing/legacy MovieSummary snapshots.
