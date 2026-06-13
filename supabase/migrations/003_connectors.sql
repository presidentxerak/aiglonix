-- AIGLONIX - API connectors. Lets external detection devices / apps push
-- events (detections, jamming, alerts) into a team via a scoped API key.
-- Apply AFTER 002_teams.sql.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  key_prefix text not null,            -- shown in the UI (e.g. aglx_1a2b3c4d)
  key_hash text not null,              -- sha256(full key) - the key is never stored
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);
create index if not exists api_keys_hash_idx on public.api_keys (key_hash);

-- RLS on, no client policies: all access goes through the SECURITY DEFINER RPCs
-- below (so the key_hash is never exposed to the browser).
alter table public.api_keys enable row level security;

-- create a key: returns the FULL key ONCE (store it now, it can't be recovered)
create or replace function public.create_api_key(key_name text) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare tid uuid; full_key text;
begin
  tid := public.current_team_id();
  if tid is null then raise exception 'no team'; end if;
  full_key := 'aglx_' || encode(gen_random_bytes(24), 'hex');
  insert into public.api_keys (team_id, name, key_prefix, key_hash, created_by)
  values (tid, trim(key_name), left(full_key, 13),
          encode(digest(full_key, 'sha256'), 'hex'), auth.uid());
  return full_key;
end $$;

-- list the caller's team keys (safe columns only - no hash)
create or replace function public.list_api_keys()
returns table (
  id uuid, name text, key_prefix text,
  created_at timestamptz, last_used_at timestamptz, revoked_at timestamptz
)
language sql security definer set search_path = public as $$
  select id, name, key_prefix, created_at, last_used_at, revoked_at
  from public.api_keys
  where team_id = public.current_team_id()
  order by created_at desc;
$$;

create or replace function public.revoke_api_key(key_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.api_keys set revoked_at = now()
  where id = key_id and team_id = public.current_team_id();
end $$;

grant execute on function public.create_api_key(text) to authenticated;
grant execute on function public.list_api_keys() to authenticated;
grant execute on function public.revoke_api_key(uuid) to authenticated;
