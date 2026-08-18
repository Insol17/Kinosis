# Cloud Sync 0.4.4

The 0.4.3.x client synchronized local changes upward but did not regularly pull a newer cloud snapshot while a second device stayed signed in. Two already-open devices could therefore look unsynchronized, and a later whole-state push could overwrite a newer remote snapshot.

0.4.4 changes the loop to:

1. load remote state on sign-in;
2. keep a per-user local cache;
3. pull when the app returns to focus/visibility, reconnects, is manually synced, or remains active for a minute;
4. before every push, read the current remote row;
5. if the remote row is newer than `lastSyncedAt`, merge by entity `updatedAt`;
6. write the merged snapshot and store Supabase `updated_at` as the new sync cursor.

Viewing-log deletes create `meta.deletedLogs[logId] = timestamp`. This prevents a stale second device from resurrecting a deleted log during a merge.

The schema is unchanged: `public.user_state` remains one RLS-protected JSONB row per authenticated user. If Settings reports `Cloud schema is missing`, run `supabase/SETUP_ALL.sql` once in the Supabase SQL Editor. If it reports an RLS permission error, re-run the policy portion of the same SQL.
