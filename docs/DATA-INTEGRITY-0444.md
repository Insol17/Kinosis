# Data integrity — 0.4.4.4

## Cloud state

User-authored Cloud payload:
- profile
- subscription preferences
- library relationship state
- viewing logs
- collections
- settings/meta required for sync

Local replaceable cache:
- TMDB movie detail cache
- availability snapshot/newly-available cache

An async Cloud write captures `snapshotRevision`. If a local mutation increments `localRevision` before the request completes, the successful response updates only the Cloud cursor/revision and leaves the new live state intact and dirty for a follow-up push.

Delete tombstones use latest-timestamp-wins per entity id.

## Film identity

A single displayed film is deduplicated using:
1. TMDB movie id; then
2. normalized original title (or title) + release year.

This identity rule is applied to global search, person filmography, Director Curation and client rails.

## Director Curation modes

- `all-directed`: all unique movie credits where the selected person is credited as Director.
- `solo-features`: runtime >= 60 minutes and the selected person is the only credited Director.

`include` and `exclude` remain explicit editorial overrides.
