-- AIGLONIX - Teams / multi-tenant isolation.
-- Each operator belongs to one team; all ops data (detections, jammer_reports,
-- messages, alerts) is scoped to a team via RLS. Apply AFTER 001_init.sql.
-- NOTE: rows created before this migration have team_id = null and become
-- invisible (RLS) - re-seed with a team if you need demo data.

-- ---------- teams ----------
create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  invite_code text not null unique,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
alter table public.teams enable row level security;

alter table public.profiles add column if not exists team_id uuid references public.teams(id);
alter table public.detections add column if not exists team_id uuid references public.teams(id);
alter table public.jammer_reports add column if not exists team_id uuid references public.teams(id);
alter table public.messages add column if not exists team_id uuid references public.teams(id);
alter table public.alerts add column if not exists team_id uuid references public.teams(id);

-- caller's team (security definer so RLS policies can call it freely)
create or replace function public.current_team_id() returns uuid
language sql stable security definer set search_path = public as $$
  select team_id from public.profiles where id = auth.uid();
$$;

-- members can read their own team row
drop policy if exists "team_read" on public.teams;
create policy "team_read" on public.teams for select to authenticated
  using (id = public.current_team_id());

-- ---------- scope reads to the caller's team ----------
drop policy if exists "read_all" on public.detections;
create policy "team_read" on public.detections for select to authenticated
  using (team_id = public.current_team_id());
drop policy if exists "read_all" on public.jammer_reports;
create policy "team_read" on public.jammer_reports for select to authenticated
  using (team_id = public.current_team_id());
drop policy if exists "read_all" on public.messages;
create policy "team_read" on public.messages for select to authenticated
  using (team_id = public.current_team_id());
drop policy if exists "read_all" on public.alerts;
create policy "team_read" on public.alerts for select to authenticated
  using (team_id = public.current_team_id());

-- ---------- inserts must target the caller's own team ----------
drop policy if exists "insert_own" on public.detections;
create policy "insert_own" on public.detections for insert to authenticated
  with check (auth.uid() = user_id and team_id = public.current_team_id());
drop policy if exists "insert_own" on public.jammer_reports;
create policy "insert_own" on public.jammer_reports for insert to authenticated
  with check (auth.uid() = user_id and team_id = public.current_team_id());
drop policy if exists "insert_own" on public.messages;
create policy "insert_own" on public.messages for insert to authenticated
  with check (auth.uid() = user_id and team_id = public.current_team_id());

-- ---------- carry team_id onto the auto-created alerts ----------
create or replace function public.detection_to_alert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.alerts (kind, ref_id, title, severity, lat, lng, team_id)
  values ('drone', new.id, 'Drone détecté: ' || new.drone_type,
          case when new.confidence >= 0.85 then 'critical'
               when new.confidence >= 0.6 then 'high' else 'medium' end,
          new.lat, new.lng, new.team_id);
  return new;
end $$;

create or replace function public.jammer_to_alert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.alerts (kind, ref_id, title, severity, lat, lng, team_id)
  values ('jammer', new.id, 'Brouillage ' || new.freq_band,
          case when new.strength >= 8 then 'critical'
               when new.strength >= 4 then 'high' else 'medium' end,
          new.lat, new.lng, new.team_id);
  return new;
end $$;

-- ---------- create / join a team (security definer = no client INSERT policy) ----------
create or replace function public.create_team(team_name text) returns public.teams
language plpgsql security definer set search_path = public as $$
declare t public.teams;
begin
  insert into public.teams (name, invite_code, created_by)
  values (trim(team_name),
          upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6)),
          auth.uid())
  returning * into t;
  update public.profiles set team_id = t.id where id = auth.uid();
  return t;
end $$;

create or replace function public.join_team(code text) returns public.teams
language plpgsql security definer set search_path = public as $$
declare t public.teams;
begin
  select * into t from public.teams where invite_code = upper(trim(code));
  if t.id is null then raise exception 'team not found'; end if;
  update public.profiles set team_id = t.id where id = auth.uid();
  return t;
end $$;

grant execute on function public.current_team_id() to authenticated;
grant execute on function public.create_team(text) to authenticated;
grant execute on function public.join_team(text) to authenticated;
