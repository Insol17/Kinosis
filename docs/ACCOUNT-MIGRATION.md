# Account migration — 0.4.3

Library and MY remain account-gated by product policy. Existing historical local KINOSIS data may still be detected after sign-in and merged into the user's Supabase-backed `user_state`.

The signed-in cloud payload is canonical, with a per-user local cache used for offline resilience. Viewing-log edits, rewatch history, availability state, Collections and preferences are included in the same versioned MVP payload.
