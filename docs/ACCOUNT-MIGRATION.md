# Account migration — 0.4.2

Personal surfaces remain account-gated. On first sign-in KINOSIS checks two sources:

1. signed-in per-user local cache
2. legacy pre-account KINOSIS local state

If legacy data exists, KINOSIS uses its own dialog (not a browser `confirm`) to ask whether it should be merged into the cloud state.

The merge keeps movie snapshots, library rows, logs, collections, subscriptions, and the user's profile fields. Cloud and local timestamps remain the basic MVP conflict-resolution mechanism.

Guests do not create new Library/MY data in 0.4.2 by product policy.
