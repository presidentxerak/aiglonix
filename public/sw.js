/**
 * AIGLONIX Service Worker — offline-first shell (§8.6).
 * Strategy: cache-first for the ONNX model and WASM runtime (large,
 * immutable), network-first with cache fallback for everything else so the
 * app keeps loading without network.
 */
const CACHE_NAME = "aiglonix-v1";
const MODEL_CACHE = "aiglonix-models-v1";

const CACHE_FIRST_PREFIXES = ["/models/", "/ort/"];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((n) => n !== CACHE_NAME && n !== MODEL_CACHE)
          .map((n) => caches.delete(n)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin) {
    return; // never intercept API calls, Supabase, tiles…
  }
  if (url.pathname.startsWith("/api/")) {
    return;
  }

  const cacheFirst = CACHE_FIRST_PREFIXES.some((p) =>
    url.pathname.startsWith(p),
  );

  if (cacheFirst) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(MODEL_CACHE);
        const cached = await cache.match(event.request);
        if (cached) return cached;
        const response = await fetch(event.request);
        if (response.ok) await cache.put(event.request, response.clone());
        return response;
      })(),
    );
    return;
  }

  // network-first with cache fallback (app shell stays usable offline)
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const response = await fetch(event.request);
        if (response.ok) await cache.put(event.request, response.clone());
        return response;
      } catch {
        const cached = await cache.match(event.request);
        if (cached) return cached;
        throw new Error("offline and not cached");
      }
    })(),
  );
});
