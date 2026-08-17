-- Optional Phase 2 cloud-sync schema. Not required by the local-first MVP.
-- Run only inside your own Supabase project after enabling Auth.

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'User',
  handle text,
  bio text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_films (
  user_id uuid not null references auth.users(id) on delete cascade,
  movie_id bigint not null,
  saved_at timestamptz not null default now(),
  watched boolean not null default false,
  watchlist boolean not null default false,
  favorite boolean not null default false,
  rating numeric(2,1) check (rating is null or (rating >= 0.5 and rating <= 5.0)),
  review text,
  primary key (user_id, movie_id)
);

create table if not exists public.viewing_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  movie_id bigint not null,
  watched_at date not null,
  rating numeric(2,1) check (rating is null or (rating >= 0.5 and rating <= 5.0)),
  review text,
  created_at timestamptz not null default now()
);

create table if not exists public.user_subscriptions (
  user_id uuid not null references auth.users(id) on delete cascade,
  provider_id integer not null,
  provider_name text not null,
  primary key (user_id, provider_id)
);

create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.collection_films (
  collection_id uuid not null references public.collections(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  movie_id bigint not null,
  added_at timestamptz not null default now(),
  primary key (collection_id, movie_id)
);

alter table public.profiles enable row level security;
alter table public.user_films enable row level security;
alter table public.viewing_logs enable row level security;
alter table public.user_subscriptions enable row level security;
alter table public.collections enable row level security;
alter table public.collection_films enable row level security;

create policy "profiles own rows" on public.profiles for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "user_films own rows" on public.user_films for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "viewing_logs own rows" on public.viewing_logs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "subscriptions own rows" on public.user_subscriptions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "collections own rows" on public.collections for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "collection_films own rows" on public.collection_films for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
