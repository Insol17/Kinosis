# Account / cloud-sync migration plan

## Current MVP
- Browser-local profile and user data.
- JSON export/import is the recovery and migration contract.
- No fake login UI and no password storage.

## Phase 2 trigger
Enable cloud accounts only after the Library / Diary loop is worth syncing across devices.

## Planned migration
1. Configure Supabase Auth.
2. Enable RLS on all user-owned tables.
3. Create an authenticated profile row on first sign-in.
4. Offer **Merge local data into account** rather than silently replacing local data.
5. Upload `user_films`, `viewing_logs`, `collections`, and `user_subscriptions` in one explicit migration transaction.
6. Keep JSON export available after cloud sync is enabled.
7. Test account deletion and full data export before public launch.

## Conflict rule candidate
For the MVP migration, prefer explicit user choice when both local and cloud contain data. Do not silently resolve destructive conflicts by timestamp alone.

## Subscription identity
Use a stable text `provider_key` for user preferences and keep TMDB `provider_id` nullable. This allows manual-only providers such as Collectio to sync without inventing a TMDB provider ID.
