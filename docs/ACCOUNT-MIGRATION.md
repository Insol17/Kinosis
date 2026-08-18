# Account migration — 0.4.1

KINOSIS 0.4.0 stored personal data in `kinosis.mvp.v2.state` / legacy `film.mvp.v2.state`.

0.4.1 blocks personal surfaces for guests. After a user signs in for the first time, KINOSIS checks for old local data and asks whether to import it into the signed-in cloud state.

- import accepted: legacy Library/Diary/Collections/Subscriptions/movie snapshots are merged and synced
- import declined: legacy storage remains on the device but is not shown as the signed-in account's Library
- migration decision is recorded per Supabase user ID to avoid repeated prompts

Signed-in device caches use a user-specific localStorage key and are not shown after sign-out.
