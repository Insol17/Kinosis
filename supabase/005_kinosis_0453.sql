-- KINOSIS 0.4.5.3 — admin-only Editorial Studio
-- Role model: regular users are implicit `user`; admins have
-- auth.users.raw_app_meta_data.user_role = 'admin'. Never store authorization
-- in user_metadata because end users can edit it themselves.

create table if not exists public.editorial_programmes (
  slug text primary key,
  kind text not null check (kind in ('editorial','director-archive')),
  surface text not null default 'arthouse' check (surface in ('arthouse','discover','both')),
  status text not null default 'draft' check (status in ('draft','published','archived')),
  priority integer not null default 100,
  payload jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.editorial_programmes enable row level security;

drop policy if exists "editorial_public_read_published" on public.editorial_programmes;
drop policy if exists "editorial_admin_read_all" on public.editorial_programmes;
drop policy if exists "editorial_admin_insert" on public.editorial_programmes;
drop policy if exists "editorial_admin_update" on public.editorial_programmes;
drop policy if exists "editorial_admin_delete" on public.editorial_programmes;

create policy "editorial_public_read_published" on public.editorial_programmes
  for select to anon, authenticated
  using (status = 'published');

create policy "editorial_admin_read_all" on public.editorial_programmes
  for select to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin');

create policy "editorial_admin_insert" on public.editorial_programmes
  for insert to authenticated
  with check ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin');

create policy "editorial_admin_update" on public.editorial_programmes
  for update to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin');

create policy "editorial_admin_delete" on public.editorial_programmes
  for delete to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin');

grant select on public.editorial_programmes to anon, authenticated;
grant insert, update, delete on public.editorial_programmes to authenticated;

comment on table public.editorial_programmes is 'KINOSIS Studio programme definitions. Public only sees published rows; admin claim can author all states.';

-- Example role assignment (run manually with the target UUID):
-- update auth.users
-- set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"user_role":"admin"}'::jsonb
-- where id = '00000000-0000-0000-0000-000000000000';

-- Public projection: published payloads are readable, archived rows are exposed
-- only as slug tombstones so they can suppress Git fallback content without
-- leaking the archived authoring payload.
create or replace function public.kinosis_public_programmes()
returns table(slug text, status text, payload jsonb, updated_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select ep.slug,
         ep.status,
         case when ep.status = 'published' then ep.payload else null end as payload,
         ep.updated_at
  from public.editorial_programmes ep
  where ep.status in ('published','archived')
  order by ep.priority asc, ep.updated_at desc;
$$;

revoke all on function public.kinosis_public_programmes() from public;
grant execute on function public.kinosis_public_programmes() to anon, authenticated;
