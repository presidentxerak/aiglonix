-- AIGLONIX - profile & team management. Apply AFTER 003_connectors.sql.
-- All mutations go through SECURITY DEFINER RPCs so clients can never set
-- team_id directly (which would let anyone join any team).

-- update your own callsign (only - never team_id)
create or replace function public.update_callsign(new_callsign text) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.profiles
  set callsign = coalesce(nullif(trim(new_callsign), ''), callsign)
  where id = auth.uid();
end $$;

-- rename the current team (creator/owner only)
create or replace function public.rename_team(new_name text) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.teams
  set name = coalesce(nullif(trim(new_name), ''), name)
  where id = public.current_team_id() and created_by = auth.uid();
  if not found then raise exception 'not team owner'; end if;
end $$;

-- leave the current team (becomes team-less -> the create/join gate returns)
create or replace function public.leave_team() returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.profiles set team_id = null where id = auth.uid();
end $$;

-- regenerate the invite code (owner only); returns the new code
create or replace function public.regenerate_invite_code() returns text
language plpgsql security definer set search_path = public as $$
declare code text;
begin
  code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
  update public.teams set invite_code = code
  where id = public.current_team_id() and created_by = auth.uid();
  if not found then raise exception 'not team owner'; end if;
  return code;
end $$;

-- list members of the caller's team (callsign + owner flag)
create or replace function public.list_team_members()
returns table (id uuid, callsign text, is_owner boolean)
language sql security definer set search_path = public as $$
  select p.id, p.callsign, (t.created_by = p.id) as is_owner
  from public.profiles p
  join public.teams t on t.id = p.team_id
  where p.team_id = public.current_team_id()
  order by is_owner desc, p.callsign;
$$;

grant execute on function public.update_callsign(text) to authenticated;
grant execute on function public.rename_team(text) to authenticated;
grant execute on function public.leave_team() to authenticated;
grant execute on function public.regenerate_invite_code() to authenticated;
grant execute on function public.list_team_members() to authenticated;
