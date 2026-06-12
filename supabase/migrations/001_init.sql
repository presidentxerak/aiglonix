-- AIGLONIX — initial schema (§4)
-- RLS on every table; authenticated team reads everything, each operator
-- writes only their own rows; alerts are written exclusively via the API
-- route with the service role. created_at/user_id are immutable (no UPDATE
-- policy on those tables) — auditability is a requirement (§2.7.8).

-- Profiles (mirror of auth.users)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  callsign text not null default 'Operator',
  created_at timestamptz not null default now()
);

-- Auto-create profile on signup (callsign from signup metadata)
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, callsign)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data->>'callsign'), ''), 'Operator')
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger trg_handle_new_user after insert on auth.users
for each row execute function public.handle_new_user();

-- Drone detections
create table public.detections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  drone_type text not null,
  confidence real not null check (confidence between 0 and 1),
  image_url text,
  status text not null default 'active' check (status in ('active','resolved','false_positive')),
  created_at timestamptz not null default now()
);

-- Jamming reports
create table public.jammer_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  freq_band text not null check (freq_band in ('2.4GHz','5.8GHz','GPS_L1','900MHz','autre')),
  strength int not null check (strength between 1 and 10),
  radius_m int not null default 500 check (radius_m between 50 and 10000),
  created_at timestamptz not null default now()
);

-- Messages (Ghost Signal) — client_id UNIQUE = idempotent resync
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  client_id text not null unique,
  user_id uuid not null references public.profiles(id),
  channel text not null default 'ops',
  body text not null check (char_length(body) between 1 and 2000),
  sent_at timestamptz not null,
  created_at timestamptz not null default now()
);

-- Unified alerts (feeds the Operation module)
create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('drone','jammer','manual')),
  ref_id uuid,
  title text not null,
  severity text not null check (severity in ('low','medium','high','critical')),
  lat double precision,
  lng double precision,
  created_at timestamptz not null default now()
);

-- RLS
alter table public.profiles enable row level security;
alter table public.detections enable row level security;
alter table public.jammer_reports enable row level security;
alter table public.messages enable row level security;
alter table public.alerts enable row level security;

create policy "read_all" on public.profiles for select to authenticated using (true);
create policy "own_profile" on public.profiles for insert to authenticated with check (auth.uid() = id);

create policy "read_all" on public.detections for select to authenticated using (true);
create policy "insert_own" on public.detections for insert to authenticated with check (auth.uid() = user_id);
create policy "update_own" on public.detections for update to authenticated using (auth.uid() = user_id);

create policy "read_all" on public.jammer_reports for select to authenticated using (true);
create policy "insert_own" on public.jammer_reports for insert to authenticated with check (auth.uid() = user_id);

create policy "read_all" on public.messages for select to authenticated using (true);
create policy "insert_own" on public.messages for insert to authenticated with check (auth.uid() = user_id);

create policy "read_all" on public.alerts for select to authenticated using (true);
-- alerts: inserts only through the API route with the service role

-- Realtime
alter publication supabase_realtime add table public.detections, public.jammer_reports, public.messages, public.alerts;

-- A detection automatically creates an alert
create or replace function public.detection_to_alert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.alerts (kind, ref_id, title, severity, lat, lng)
  values ('drone', new.id,
          'Drone détecté: ' || new.drone_type,
          case when new.confidence >= 0.85 then 'critical'
               when new.confidence >= 0.6 then 'high'
               else 'medium' end,
          new.lat, new.lng);
  return new;
end $$;

create trigger trg_detection_alert after insert on public.detections
for each row execute function public.detection_to_alert();

-- A jamming report also creates an alert (Operation sees everything)
create or replace function public.jammer_to_alert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.alerts (kind, ref_id, title, severity, lat, lng)
  values ('jammer', new.id,
          'Brouillage ' || new.freq_band,
          case when new.strength >= 8 then 'critical'
               when new.strength >= 4 then 'high'
               else 'medium' end,
          new.lat, new.lng);
  return new;
end $$;

create trigger trg_jammer_alert after insert on public.jammer_reports
for each row execute function public.jammer_to_alert();

-- PRIVATE storage bucket for detection images (signed URLs only, §2.7.6)
insert into storage.buckets (id, name, public)
values ('detections', 'detections', false)
on conflict (id) do nothing;

create policy "detections_upload_own" on storage.objects
for insert to authenticated
with check (bucket_id = 'detections' and (storage.foldername(name))[1] = auth.uid()::text);
