# Cloud Sync 0.4.4.3

0.4.4 added foreground pulls and entity-level merging. 0.4.4.3 closes the remaining read/merge/write race at the database boundary.

## Write protocol

1. Client reads `payload`, `updated_at`, `revision`.
2. Client merges a newer remote payload when needed.
3. Client calls `kinosis_write_user_state(expected_revision, new_payload)`.
4. Postgres serializes writes for that `auth.uid()` and compares `expected_revision` with the current row.
5. If stale, the RPC returns `conflict:true`; the client rereads, merges and retries.
6. If current, the RPC increments the revision and writes the payload in the same transaction.

Run `supabase/004_kinosis_0443.sql` once on an existing project.

This is still a compact one-row-per-user MVP schema. If KINOSIS later adds public reviews/social queries, user data should be normalized into queryable tables instead of stretching the JSON snapshot model indefinitely.
