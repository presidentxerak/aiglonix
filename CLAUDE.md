# CLAUDE.md — mémoire projet AIGLONIX

## Mission
App web de défense collaborative, 100% fonctionnelle en prod Vercel.
Slogan : « De la détection à la décision en quelques secondes. »

## Périmètre verrouillé
1. **Drone Sentinel** — détection IA dans le navigateur (onnxruntime-web, WASM)
2. **Map Vision** — carte collaborative temps réel des brouillages
3. **Operation** — vue tactique unifiée (carte + flux + compteurs + Presence)
4. **Ghost Signal** — messagerie PWA offline-first (outbox pattern)
5. **Landing** — pitch deck vivant, bilingue FR/EN
6. **Voice Map** — Voice-to-Map : dictée vocale → marqueur temps réel sur la
   carte (challenge « Voice-to-Map: Real-Time Positional Tracking »).

Hors périmètre : mobile natif, backend Python, Bluetooth/LoRa/mesh, SensorFusion, AutoIntercept 3D.

## Stack (verrouillée — toute dépendance hors liste exige une justification ici)
Next.js 15 App Router · TS strict (zéro `any`, zéro `@ts-ignore`) · Tailwind v4 ·
Supabase (PostgreSQL + Auth + Realtime + Storage) · Leaflet/react-leaflet ·
onnxruntime-web · Zod · next-intl · Turnstile · Upstash Redis · Vercel.
Composants UI : primitives maison style shadcn (cva + tailwind-merge) — le CLI
shadcn n'a pas été utilisé, les primitives nécessaires (Button, Input, Card,
Select, badge) sont dans `components/ui/`, plus `sonner` pour les toasts.
**Voice Map** (challenge Voice-to-Map) : Deepgram (STT temps réel), Mistral
(extraction lieu/intention) et OpenStreetMap/Nominatim (géocodage). Ce sont des
**services externes** appelés via `fetch`/WebSocket — **zéro dépendance npm
ajoutée**. Clés serveur-only (`DEEPGRAM_API_KEY`, `MISTRAL_API_KEY`) ; le client
n'obtient qu'un token Deepgram éphémère (`/api/voice/token`). Dégradation propre :
pas de clé Deepgram → Web Speech API du navigateur ; pas de Mistral → parseur
heuristique (`lib/voice/extract.ts`) ; Nominatim sans clé.

## État des phases
- [x] **Phase 0 — Fondations** : scaffold, design system §2.5 (tokens dans
  `app/globals.css`, Outfit via next/font), headers sécurité §2.7.1
  (`next.config.ts`), i18n next-intl (`app/[locale]/`, dictionnaires
  `messages/{fr,en}.json`), auth login/signup + Turnstile (optionnel via env),
  middleware (intl + refresh session + protection routes), migration
  `supabase/migrations/001_init.sql`.
- [x] **Phase 1 — Map Vision** : carte dark CartoDB, signalement par appui
  long (Leaflet mappe le long-press tactile sur `contextmenu`) ou double-clic,
  cercles par intensité, Realtime INSERT, bannière recommandation 2.4GHz→900MHz.
- [x] **Phase 2 — Drone Sentinel** : chaîne complète preprocess letterbox →
  inférence WASM → décodage YOLOv8 [1,84,8400] → NMS → overlay SVG animé.
  Modèle `public/models/yolov8n.onnx` (COCO — classes airplane/bird/kite pour
  valider la chaîne). Recompression canvas (destruction EXIF), bucket privé,
  publication via la file offline.
- [x] **Phase 3 — Operation** : carte unifiée, flux d'alertes Realtime avec
  flash critique, compteurs count-up, Presence `ops-room`, alerte manuelle via
  POST /api/alerts (Zod + service role + rate limit).
- [x] **Phase 4 — Ghost Signal** : outbox IndexedDB (idb-keyval), resync
  online+10s, idempotence par `client_id` UNIQUE (23505 = déjà livré), tri par
  `sent_at` client, badges ⏳→✅ en cascade 120ms, liens neutralisés.
- [x] **Phase 5 — Landing** : pitch deck complet FR/EN, radar sweep CSS,
  reveal au scroll, count-up des chiffres preuve, section sécurité, roadmap.
- [x] **Fonctionnalité maîtresse — Triangulation** (challenge EDTH « opérer
  sous brouillage ») : `lib/triangulation.ts`, ≥3 signalements actifs de la
  même bande → clustering 5 km → centroïde pondéré strength² → émetteur
  estimé (croix de visée + cercle d'incertitude pointillé sur les cartes,
  bannière Map Vision, compteur Operation, section landing « challenge »).
- [x] **Voice Map — Voice-to-Map** (challenge « Real-Time Positional
  Tracking ») : `app/[locale]/(app)/voice-map`. Pipeline : voix → STT
  (`lib/voice/stt.ts` : Deepgram WS via token éphémère, fallback Web Speech) →
  extraction lieu/action (`/api/voice/extract` : Mistral, fallback heuristique)
  → géocodage (`/api/voice/geocode` : Nominatim, cache mémoire) → marqueur
  vocal sur `TacticalMap` (prop `pins`) + flyTo. Markers côté client (session)
  pour l'instant ; persistance Supabase = prochaine étape si collaboration
  voulue. Routes API : session + rate limit (`voice:<uid>`) + Zod, clés
  serveur-only.
- [ ] **Déploiement** : nécessite un projet Supabase réel + projet Vercel
  (voir README — migration à appliquer, env vars à renseigner).

## Décisions prises
- **Design system v2** : police racine agrandie (`html { font-size: 17.5px }`)
  pour la lisibilité ; **aucun tiret cadratin (— / –) dans l'app** — utiliser
  un trait d'union. Dégradés animés (`@keyframes grad-shift`) : `.btn-gradient`
  (bleu ciel→bleu foncé) sur boutons/liens importants ; `.grad-magenta` /
  `.unit-fill` / `.alert-gradient` (magenta→rouge) sur icônes et alertes carte ;
  bordure de carte en dégradé animé au survol (`.card::after`). Toutes les
  animations sont coupées sous `prefers-reduced-motion`.
- **i18n** : segment `app/[locale]/`, fallback `en`, aucune chaîne en dur.
- **Auth** : cookies httpOnly via @supabase/ssr ; protection des routes via
  `AuthGuard` client (`getSession()` local — un opérateur hors ligne garde
  l'accès) + RLS + session vérifiée dans les API routes. PAS de middleware
  (voir Pièges). Turnstile et Upstash sont
  optionnels : l'app dégrade proprement si les env vars manquent (limiteur
  mémoire en fallback — la protection ne disparaît jamais silencieusement).
- **Alerts** : aucune policy INSERT client ; seule l'API route écrit (service
  role) après session + rate limit + Zod. Trigger SQL : detection→alert et
  jammer→alert (ajout vs. spec : les brouillages alimentent aussi le flux).
- **Profils** : trigger `handle_new_user` sur auth.users (ajout vs. spec §4 —
  sans lui, les FK user_id cassent au premier insert).
- **ONNX** : wasm servi same-origin depuis `public/ort/` (copié en postinstall)
  pour rester compatible CSP `default-src 'self'` ; CSP inclut
  `wasm-unsafe-eval` (requis WebAssembly) et `unsafe-inline` script (scripts
  inline du runtime Next — pas de nonce en 48h).
- **Publication détection** : passe TOUJOURS par l'outbox (blob en IndexedDB
  puis upload+insert au flush) — un seul chemin de code, l'offline est gratuit.
- **Modèle** : yolov8n COCO (12,8 Mo, licence AGPL-3.0 Ultralytics — OK
  hackathon, à revalider pour un produit commercial). Interchangeable : seul
  `CLASS_NAMES` dans `lib/onnx/detector.ts` change.

- **Challenge choisi** : **Durandal — « Collaborative Jammer Detection and
  Localization for Contested Environments »** (liste officielle EDTH Paris
  2026). Énoncé : détecter, classifier et géolocaliser les sources
  d'interférence RF avec des capteurs distribués + interface opérateur —
  correspondance directe avec Map Vision (détection = signalements,
  classification = bande, géolocalisation = triangulation, contre-mesure =
  bannière 2.4→900MHz). La triangulation est volontairement 100 % client :
  calcul pur et déterministe sur les lignes Realtime partagées → même
  estimation chez tous les opérateurs, zéro backend ajouté, fonctionne
  offline sur le cache. La vraie multilatération RSSI (capteurs RF réels)
  est la slide roadmap, pas une promesse de démo.

## Pièges rencontrés
- Leaflet casse au SSR → `next/dynamic` ssr:false dans
  `components/map/tactical-map.tsx`, jamais d'import statique.
- huggingface.co hors allowlist réseau du sandbox → modèle récupéré depuis
  GitHub (Hyuto/yolov8-onnxruntime-web).
- Long-press mobile : Leaflet le traduit en évènement `contextmenu` — pas
  besoin de timer maison.
- `npm audit` : 3 avis *modérés* sur le postcss embarqué dans Next (toutes
  les 15.x sont concernées, GHSA-qx2v-qp2m-jg93, build-time uniquement, CSS
  non fiable — non applicable ici). Aucune vulnérabilité critique/haute.
  À re-vérifier à chaque montée de version de Next.
- `MIDDLEWARE_INVOCATION_FAILED` (500) en prod Vercel : sur CE compte
  Vercel, **tout middleware Edge crashe au runtime quelle que soit la
  simplicité du code** (testé : middleware supabase+intl, puis fail-open
  try/catch, puis imports dynamiques, puis zéro dépendance — tous 500).
  Même problème déjà rencontré et résolu dans le repo `nostradameme`
  (commit « Remove Edge middleware to fix MIDDLEWARE_INVOCATION_FAILED »,
  avril 2026). **Solution éprouvée : AUCUN middleware.ts.** Locale routing
  via `redirects()` statiques dans next.config.ts ; protection des routes
  via AuthGuard client (getSession local, offline-friendly) ; la vraie
  sécurité reste RLS + vérification de session dans les API routes. Ne
  JAMAIS réintroduire de middleware dans ce projet.

## Prochaines étapes
1. Créer le projet Supabase, appliquer `001_init.sql`, activer la protection
   mots de passe compromis + min 12 caractères (dashboard Auth), créer les
   clés Turnstile, configurer Vercel (env vars de `.env.example`).
2. Vérifier le checkpoint Phase 0 sur l'URL de prod (compte → login → Operation).
3. Phase 5 finale : captures d'écran réelles dans la landing/README, seed.sql,
   capture securityheaders.com, npm audit, répétition du script de démo §12.
