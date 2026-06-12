-- AIGLONIX — realistic demo seed around Paris (Phase 5).
-- Run AFTER at least one user exists; replace the operator id below.
-- usage: psql ... -v operator_id='<uuid of a profile>' -f seed.sql

-- 5 detections
insert into public.detections (user_id, lat, lng, drone_type, confidence, status, created_at) values
  (:'operator_id', 48.8738, 2.2950, 'airplane', 0.91, 'active', now() - interval '3 minutes'),
  (:'operator_id', 48.8470, 2.3380, 'kite',     0.78, 'active', now() - interval '12 minutes'),
  (:'operator_id', 48.8919, 2.3370, 'airplane', 0.64, 'active', now() - interval '25 minutes'),
  (:'operator_id', 48.8290, 2.3700, 'bird',     0.55, 'resolved', now() - interval '2 hours'),
  (:'operator_id', 48.8606, 2.4030, 'airplane', 0.87, 'active', now() - interval '40 minutes');

-- 8 jamming reports
insert into public.jammer_reports (user_id, lat, lng, freq_band, strength, radius_m, created_at) values
  (:'operator_id', 48.8584, 2.2945, '2.4GHz', 8, 1200, now() - interval '5 minutes'),
  (:'operator_id', 48.8530, 2.3499, 'GPS_L1', 6,  800, now() - interval '10 minutes'),
  (:'operator_id', 48.8867, 2.3431, '5.8GHz', 4,  500, now() - interval '15 minutes'),
  (:'operator_id', 48.8420, 2.3219, '2.4GHz', 9, 2000, now() - interval '20 minutes'),
  (:'operator_id', 48.8666, 2.3893, '900MHz', 3,  400, now() - interval '28 minutes'),
  (:'operator_id', 48.8320, 2.2890, 'GPS_L1', 7, 1500, now() - interval '50 minutes'),
  (:'operator_id', 48.8790, 2.3160, '2.4GHz', 5,  700, now() - interval '90 minutes'),
  (:'operator_id', 48.8480, 2.3970, 'autre',  2,  300, now() - interval '3 hours');

-- 5 Ghost Signal messages (ops channel). client_id is the idempotency key
-- (UNIQUE) — keep the seed ids stable so re-running never duplicates rows.
insert into public.messages (client_id, user_id, channel, body, sent_at) values
  ('seed-msg-1', :'operator_id', 'ops', 'Prise de poste secteur Trocadéro, RAS.', now() - interval '55 minutes'),
  ('seed-msg-2', :'operator_id', 'ops', 'Brouillage 2.4GHz confirmé sur la rive, je bascule en 900MHz.', now() - interval '48 minutes'),
  ('seed-msg-3', :'operator_id', 'ops', 'Triangulation en cours, 3 signalements alignés.', now() - interval '40 minutes'),
  ('seed-msg-4', :'operator_id', 'ops', 'Émetteur estimé près de la Tour Eiffel, je remonte la position.', now() - interval '32 minutes'),
  ('seed-msg-5', :'operator_id', 'ops', 'Mode dégradé activé, messages en file. Réseau instable.', now() - interval '20 minutes')
on conflict (client_id) do nothing;
