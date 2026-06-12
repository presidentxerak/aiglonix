# AIGLONIX

**De la détection à la décision en quelques secondes. / From detection to decision. In seconds. Even jammed.**

Plateforme tactique web construite en 48h pour l'European Defense Tech Hackathon (Paris, juin 2026) :

| Module | Capacité |
|---|---|
| **Drone Sentinel** | Détection de drones par IA **dans le navigateur** (onnxruntime-web, WASM) — fonctionne en zone brouillée/déconnectée |
| **Map Vision** | Cartographie collaborative temps réel des zones de brouillage (Leaflet + Supabase Realtime) |
| **Operation** | Vue tactique unifiée : carte, flux d'alertes, compteurs, opérateurs en ligne (Presence) |
| **Ghost Signal** | Messagerie PWA offline-first — outbox pattern, idempotence garantie en base |

**Challenge EDTH (Durandal) : « Collaborative Jammer Detection and
Localization for Contested Environments ».** Détecter, classifier et
géolocaliser les sources d'interférence RF avec des capteurs distribués —
ici, les capteurs distribués sont les opérateurs eux-mêmes.
Fonctionnalité maîtresse : **triangulation collaborative des émetteurs** —
3 signalements actifs de la même bande suffisent pour estimer la position de
l'émetteur (centroïde pondéré par l'intensité², clustering 5 km, rayon
d'incertitude honnête). Le fix apparaît chez toute l'équipe en < 2 s : croix
de visée + cercle pointillé sur les cartes, bannière « émetteur localisé »,
compteur dédié sur Operation. Calcul pur côté client sur les données Realtime
partagées : déterministe, zéro infra ajoutée, fonctionne offline.

## Stack

Next.js 15 (App Router) · TypeScript strict · Tailwind v4 · Supabase (Postgres + Auth + Realtime + Storage) · react-leaflet · onnxruntime-web · Zod · next-intl (FR/EN) · Cloudflare Turnstile · Upstash Redis · Vercel.

## Démarrage

```bash
npm install                 # copie aussi le runtime WASM ONNX vers public/ort/
cp .env.example .env.local  # renseigner les variables
npm run dev
```

### Mise en place Supabase (one-shot)

1. Créer un projet sur [supabase.com](https://supabase.com).
2. Appliquer `supabase/migrations/001_init.sql` (SQL Editor) — tables, RLS,
   triggers, publication Realtime et bucket privé `detections` inclus.
3. Dashboard → Authentication : mot de passe **12 caractères minimum**,
   activer **leaked password protection** (HaveIBeenPwned), et brancher
   Turnstile (Attack protection → Captcha) avec vos clés Cloudflare.
4. Renseigner `.env.local` / les env vars Vercel (voir `.env.example`).
   `SUPABASE_SERVICE_ROLE_KEY` est **serveur uniquement**.
5. (Démo) Données de seed : `supabase/seed.sql` autour de Paris.

### Déploiement

Push sur `main` = déploiement Vercel. `npm run build` doit passer avant chaque
commit. Env vars dans le dashboard Vercel uniquement — jamais dans le repo.

## Sécurité (« secure by design », §2.7 du cahier des charges)

- En-têtes durcis sur toutes les routes (CSP, HSTS preload, X-Frame-Options
  DENY, nosniff, Permissions-Policy) — `next.config.ts`.
- Sessions en cookies httpOnly (@supabase/ssr), jamais de token en localStorage.
- RLS sur toutes les tables ; `alerts` n'a pas de policy INSERT client : seule
  l'API route écrit, après vérification de session + rate limit (10 req/min,
  Upstash ou fallback mémoire) + validation Zod.
- Zod sur 100 % des entrées (formulaires, API, payloads Realtime, outbox).
- Upload images : magic bytes vérifiés, 8 Mo max, **recompression canvas qui
  détruit les EXIF/GPS** avant envoi, bucket privé + URLs signées 1h.
- Liens dans Ghost Signal rendus non-cliquables avec domaine en évidence.
- `/.well-known/security.txt`, politique anti-phishing affichée au login.
- Aucun `dangerouslySetInnerHTML`, aucun `any`, aucun `@ts-ignore`.

## Modèle de détection

`public/models/yolov8n.onnx` — YOLOv8n COCO 640×640 (12,8 Mo, licence
AGPL-3.0 Ultralytics). Les classes `airplane`/`bird`/`kite` valident la chaîne
complète ; remplacer par un modèle drone spécialisé = remplacer le fichier et
`CLASS_NAMES` dans `lib/onnx/detector.ts`.

## Test de la triangulation (la fonctionnalité maîtresse en démo)

1. Map Vision : 3 appuis longs autour d'un même point, même bande (ex. 2.4GHz),
   intensités variées.
2. Au 3e signalement publié : croix de visée rouge + cercle d'incertitude en
   pointillés + bannière « ◎ Émetteur 2.4GHz localisé par triangulation ».
3. Sur l'écran projeté (Operation) : le compteur « Émetteurs localisés »
   s'incrémente et le fix apparaît sur la carte unifiée — en < 2 s.

## Test du mode offline (le moment fort de la démo)

1. Ouvrir Ghost Signal, passer en mode avion.
2. Envoyer 3 messages → badges « ⏳ en attente », bannière mode dégradé.
3. Couper le mode avion → les badges passent à ✅ un par un, les messages
   arrivent sur les autres appareils dans l'ordre (`sent_at` client), sans
   doublon (contrainte UNIQUE sur `client_id`).
