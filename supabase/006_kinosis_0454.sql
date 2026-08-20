-- KINOSIS 0.4.5.4 — lightweight Studio listing metadata
-- Full programme JSON remains in payload and is loaded only when an editor opens it.

alter table public.editorial_programmes
  add column if not exists title text,
  add column if not exists description text;

update public.editorial_programmes
set title = coalesce(nullif(title, ''), payload ->> 'title'),
    description = coalesce(nullif(description, ''), payload ->> 'description')
where title is null or description is null;

comment on column public.editorial_programmes.title is 'Lightweight Studio list title; canonical authoring payload remains payload jsonb.';
comment on column public.editorial_programmes.description is 'Lightweight Studio list description; avoids fetching large Director snapshots in the Studio list.';
