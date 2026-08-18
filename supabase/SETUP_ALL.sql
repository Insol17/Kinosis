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

-- KINOSIS 0.4.4.3 — atomic cloud sync revision
-- Safe to run on an existing 0.4.x project.

alter table public.user_state
  add column if not exists revision bigint not null default 0;

create or replace function public.kinosis_write_user_state(expected_revision bigint, new_payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  current_revision bigint;
  current_updated_at timestamptz;
  next_revision bigint;
  next_updated_at timestamptz;
begin
  if uid is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  -- Serialize writes for one account, including the first insert where no row exists yet.
  perform pg_advisory_xact_lock(hashtextextended(uid::text, 0));

  select revision, updated_at
    into current_revision, current_updated_at
  from public.user_state
  where user_id = uid;

  if not found then
    if coalesce(expected_revision, 0) <> 0 then
      return jsonb_build_object('conflict', true, 'revision', 0, 'updated_at', null);
    end if;

    insert into public.user_state (user_id, payload, updated_at, revision)
    values (uid, coalesce(new_payload, '{}'::jsonb), now(), 1)
    returning revision, updated_at into next_revision, next_updated_at;

    return jsonb_build_object('conflict', false, 'revision', next_revision, 'updated_at', next_updated_at);
  end if;

  if current_revision <> coalesce(expected_revision, 0) then
    return jsonb_build_object('conflict', true, 'revision', current_revision, 'updated_at', current_updated_at);
  end if;

  update public.user_state
  set payload = coalesce(new_payload, '{}'::jsonb),
      updated_at = now(),
      revision = revision + 1
  where user_id = uid
  returning revision, updated_at into next_revision, next_updated_at;

  return jsonb_build_object('conflict', false, 'revision', next_revision, 'updated_at', next_updated_at);
end;
$$;

revoke all on function public.kinosis_write_user_state(bigint, jsonb) from public, anon;
grant execute on function public.kinosis_write_user_state(bigint, jsonb) to authenticated;

comment on function public.kinosis_write_user_state(bigint, jsonb)
is 'Atomic per-user KINOSIS state write with revision conflict detection.';

