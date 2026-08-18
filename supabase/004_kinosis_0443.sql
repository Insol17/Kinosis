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
