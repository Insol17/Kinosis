-- KINOSIS 0.4.1 — minimal account/cloud-sync schema
-- Run this once in Supabase Dashboard -> SQL Editor.
-- The browser only uses the project's Publishable Key. RLS is the security boundary.

create table if not exists public.user_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_state enable row level security;

drop policy if exists "user_state_select_own" on public.user_state;
drop policy if exists "user_state_insert_own" on public.user_state;
drop policy if exists "user_state_update_own" on public.user_state;
drop policy if exists "user_state_delete_own" on public.user_state;

create policy "user_state_select_own" on public.user_state
  for select to authenticated using (auth.uid() = user_id);
create policy "user_state_insert_own" on public.user_state
  for insert to authenticated with check (auth.uid() = user_id);
create policy "user_state_update_own" on public.user_state
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "user_state_delete_own" on public.user_state
  for delete to authenticated using (auth.uid() = user_id);

grant select, insert, update, delete on public.user_state to authenticated;
revoke all on public.user_state from anon;

-- Tiny public row used by a Netlify Scheduled Function as an external database health request.
-- It contains no user data and is intentionally read-only to anonymous clients.
create table if not exists public.app_health (
  id integer primary key,
  label text not null,
  created_at timestamptz not null default now()
);
insert into public.app_health (id,label) values (1,'kinosis') on conflict (id) do update set label=excluded.label;
alter table public.app_health enable row level security;
drop policy if exists "app_health_public_read" on public.app_health;
create policy "app_health_public_read" on public.app_health for select to anon, authenticated using (true);
grant select on public.app_health to anon, authenticated;
revoke insert, update, delete on public.app_health from anon, authenticated;

comment on table public.user_state is 'KINOSIS MVP per-user versioned JSON state. Normalize into social/query tables only when the product needs public reviews/follows.';
comment on table public.app_health is 'Non-sensitive one-row health target for external scheduled checks.';
