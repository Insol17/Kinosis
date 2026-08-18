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
-- KINOSIS 0.4.2 — admin roles + editorial curations
-- Run AFTER 001_kinosis_041.sql.

create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'user' check (role in ('user','editor','admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_roles enable row level security;
drop policy if exists "user_roles_read_own" on public.user_roles;
create policy "user_roles_read_own" on public.user_roles
  for select to authenticated using (auth.uid() = user_id);
grant select on public.user_roles to authenticated;
revoke insert, update, delete on public.user_roles from anon, authenticated;

create or replace function public.kinosis_is_editor()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role in ('editor','admin')
  );
$$;
revoke all on function public.kinosis_is_editor() from public;
grant execute on function public.kinosis_is_editor() to anon, authenticated;

create table if not exists public.curations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  subtitle text not null default '',
  description text not null default '',
  surface text not null default 'arthouse' check (surface in ('discover','arthouse','both')),
  type text not null default 'selection' check (type in ('directors_archive','selection','theme')),
  status text not null default 'draft' check (status in ('draft','published')),
  starts_at timestamptz null,
  ends_at timestamptz null,
  sort_order integer not null default 0,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.curation_movies (
  curation_id uuid not null references public.curations(id) on delete cascade,
  tmdb_id bigint not null,
  position integer not null default 0,
  movie_snapshot jsonb not null default '{}'::jsonb,
  primary key (curation_id, tmdb_id)
);

alter table public.curations enable row level security;
alter table public.curation_movies enable row level security;

-- Public users can only read published curations.
drop policy if exists "curations_public_read_published" on public.curations;
create policy "curations_public_read_published" on public.curations
  for select to anon, authenticated
  using (status = 'published' or public.kinosis_is_editor());

-- Editors/admins may create and manage curations.
drop policy if exists "curations_editor_insert" on public.curations;
drop policy if exists "curations_editor_update" on public.curations;
drop policy if exists "curations_editor_delete" on public.curations;
create policy "curations_editor_insert" on public.curations
  for insert to authenticated with check (public.kinosis_is_editor());
create policy "curations_editor_update" on public.curations
  for update to authenticated using (public.kinosis_is_editor()) with check (public.kinosis_is_editor());
create policy "curations_editor_delete" on public.curations
  for delete to authenticated using (public.kinosis_is_editor());

-- Items are readable when the parent curation is public, or by an editor.
drop policy if exists "curation_movies_public_read" on public.curation_movies;
create policy "curation_movies_public_read" on public.curation_movies
  for select to anon, authenticated using (
    public.kinosis_is_editor() or exists (
      select 1 from public.curations c
      where c.id = curation_id and c.status = 'published'
    )
  );

drop policy if exists "curation_movies_editor_insert" on public.curation_movies;
drop policy if exists "curation_movies_editor_update" on public.curation_movies;
drop policy if exists "curation_movies_editor_delete" on public.curation_movies;
create policy "curation_movies_editor_insert" on public.curation_movies
  for insert to authenticated with check (public.kinosis_is_editor());
create policy "curation_movies_editor_update" on public.curation_movies
  for update to authenticated using (public.kinosis_is_editor()) with check (public.kinosis_is_editor());
create policy "curation_movies_editor_delete" on public.curation_movies
  for delete to authenticated using (public.kinosis_is_editor());

grant select on public.curations, public.curation_movies to anon, authenticated;
grant insert, update, delete on public.curations, public.curation_movies to authenticated;

-- IMPORTANT: appoint admins only from the SQL Editor / service role.
-- Replace the email below, run once, then remove/comment the statement.
-- insert into public.user_roles (user_id, role)
-- select id, 'admin' from auth.users where email = 'YOUR_EMAIL@example.com'
-- on conflict (user_id) do update set role = excluded.role, updated_at = now();

comment on table public.curations is 'KINOSIS editorial curation metadata for Discover / Arthouse.';
comment on table public.curation_movies is 'Ordered TMDB movies and snapshots inside a KINOSIS curation.';
