-- AIGLONIX - realistic demo seed around Paris (team-aware, after migration 002).
-- Runs as-is in the Supabase SQL Editor. It picks the FIRST existing profile as
-- the operator, ensures that operator has a team (creates "Demo Team" / code
-- DEMO01 if needed), and tags every row with that team_id so the data is
-- visible under the team-scoped RLS. Sign up at least one account first.

do $$
declare
  op uuid;
  tid uuid;
begin
  select id into op from public.profiles order by created_at limit 1;
  if op is null then
    raise notice 'No profile found - sign up an account before seeding.';
    return;
  end if;

  -- ensure the operator belongs to a team
  select team_id into tid from public.profiles where id = op;
  if tid is null then
    insert into public.teams (name, invite_code, created_by)
    values ('Demo Team', 'DEMO01', op)
    on conflict (invite_code) do update set name = excluded.name
    returning id into tid;
    update public.profiles set team_id = tid where id = op;
  end if;

  -- 5 detections
  insert into public.detections (user_id, team_id, lat, lng, drone_type, confidence, status, created_at) values
    (op, tid, 48.8738, 2.2950, 'airplane', 0.91, 'active',   now() - interval '3 minutes'),
    (op, tid, 48.8470, 2.3380, 'kite',     0.78, 'active',   now() - interval '12 minutes'),
    (op, tid, 48.8919, 2.3370, 'airplane', 0.64, 'active',   now() - interval '25 minutes'),
    (op, tid, 48.8290, 2.3700, 'bird',     0.55, 'resolved', now() - interval '2 hours'),
    (op, tid, 48.8606, 2.4030, 'airplane', 0.87, 'active',   now() - interval '40 minutes');

  -- 8 jamming reports (the three 2.4GHz rows cluster within 5 km -> triangulation fires)
  insert into public.jammer_reports (user_id, team_id, lat, lng, freq_band, strength, radius_m, created_at) values
    (op, tid, 48.8584, 2.2945, '2.4GHz', 8, 1200, now() - interval '5 minutes'),
    (op, tid, 48.8530, 2.3499, 'GPS_L1', 6,  800, now() - interval '10 minutes'),
    (op, tid, 48.8867, 2.3431, '5.8GHz', 4,  500, now() - interval '15 minutes'),
    (op, tid, 48.8420, 2.3219, '2.4GHz', 9, 2000, now() - interval '20 minutes'),
    (op, tid, 48.8666, 2.3893, '900MHz', 3,  400, now() - interval '28 minutes'),
    (op, tid, 48.8320, 2.2890, 'GPS_L1', 7, 1500, now() - interval '50 minutes'),
    (op, tid, 48.8790, 2.3160, '2.4GHz', 5,  700, now() - interval '90 minutes'),
    (op, tid, 48.8480, 2.3970, 'autre',  2,  300, now() - interval '3 hours');

  -- 5 Ghost Signal messages (client_id is the UNIQUE idempotency key)
  insert into public.messages (client_id, user_id, team_id, channel, body, sent_at) values
    ('seed-msg-1', op, tid, 'ops', 'Prise de poste secteur Trocadéro, RAS.', now() - interval '55 minutes'),
    ('seed-msg-2', op, tid, 'ops', 'Brouillage 2.4GHz confirmé sur la rive, je bascule en 900MHz.', now() - interval '48 minutes'),
    ('seed-msg-3', op, tid, 'ops', 'Triangulation en cours, 3 signalements alignés.', now() - interval '40 minutes'),
    ('seed-msg-4', op, tid, 'ops', 'Émetteur estimé près de la Tour Eiffel, je remonte la position.', now() - interval '32 minutes'),
    ('seed-msg-5', op, tid, 'ops', 'Mode dégradé activé, messages en file. Réseau instable.', now() - interval '20 minutes')
  on conflict (client_id) do nothing;

  raise notice 'Seeded team % for operator %', tid, op;
end $$;
