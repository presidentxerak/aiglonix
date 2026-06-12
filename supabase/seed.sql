-- AIGLONIX — realistic demo seed around Paris (Phase 5).
-- Runs as-is in the Supabase SQL Editor: it auto-picks the FIRST existing
-- profile as the operator, so create at least one account (sign up) before
-- running this. To target a specific operator instead, replace the
-- `(select id from public.profiles order by created_at limit 1)` subquery
-- with `'<uuid>'::uuid`.

-- 5 detections
insert into public.detections (user_id, lat, lng, drone_type, confidence, status, created_at)
select op.id, v.lat, v.lng, v.drone_type, v.confidence, v.status, now() - v.age
from (select id from public.profiles order by created_at limit 1) op
cross join (values
  (48.8738, 2.2950, 'airplane', 0.91::real, 'active',   interval '3 minutes'),
  (48.8470, 2.3380, 'kite',     0.78::real, 'active',   interval '12 minutes'),
  (48.8919, 2.3370, 'airplane', 0.64::real, 'active',   interval '25 minutes'),
  (48.8290, 2.3700, 'bird',     0.55::real, 'resolved', interval '2 hours'),
  (48.8606, 2.4030, 'airplane', 0.87::real, 'active',   interval '40 minutes')
) as v(lat, lng, drone_type, confidence, status, age);

-- 8 jamming reports (the three 2.4GHz rows cluster within 5 km → triangulation fires)
insert into public.jammer_reports (user_id, lat, lng, freq_band, strength, radius_m, created_at)
select op.id, v.lat, v.lng, v.freq_band, v.strength, v.radius_m, now() - v.age
from (select id from public.profiles order by created_at limit 1) op
cross join (values
  (48.8584, 2.2945, '2.4GHz', 8, 1200, interval '5 minutes'),
  (48.8530, 2.3499, 'GPS_L1', 6,  800, interval '10 minutes'),
  (48.8867, 2.3431, '5.8GHz', 4,  500, interval '15 minutes'),
  (48.8420, 2.3219, '2.4GHz', 9, 2000, interval '20 minutes'),
  (48.8666, 2.3893, '900MHz', 3,  400, interval '28 minutes'),
  (48.8320, 2.2890, 'GPS_L1', 7, 1500, interval '50 minutes'),
  (48.8790, 2.3160, '2.4GHz', 5,  700, interval '90 minutes'),
  (48.8480, 2.3970, 'autre',  2,  300, interval '3 hours')
) as v(lat, lng, freq_band, strength, radius_m, age);

-- 5 Ghost Signal messages (ops channel). client_id is the idempotency key
-- (UNIQUE) — stable seed ids so re-running never duplicates rows.
insert into public.messages (client_id, user_id, channel, body, sent_at)
select v.client_id, op.id, 'ops', v.body, now() - v.age
from (select id from public.profiles order by created_at limit 1) op
cross join (values
  ('seed-msg-1', 'Prise de poste secteur Trocadéro, RAS.', interval '55 minutes'),
  ('seed-msg-2', 'Brouillage 2.4GHz confirmé sur la rive, je bascule en 900MHz.', interval '48 minutes'),
  ('seed-msg-3', 'Triangulation en cours, 3 signalements alignés.', interval '40 minutes'),
  ('seed-msg-4', 'Émetteur estimé près de la Tour Eiffel, je remonte la position.', interval '32 minutes'),
  ('seed-msg-5', 'Mode dégradé activé, messages en file. Réseau instable.', interval '20 minutes')
) as v(client_id, body, age)
on conflict (client_id) do nothing;
