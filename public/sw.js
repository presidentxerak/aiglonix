/**
 * AIGLONIX Service Worker - offline-first shell (§8.6).
 * Strategy: cache-first for the ONNX model and WASM runtime (large,
 * immutable); network-first with cache fallback for navigations and static
 * assets. It NEVER throws (so it can't break navigation/prefetch) and never
 * touches API calls, cross-origin requests, media, or range requests.
 */
const CACHE_NAME = "aiglonix-v3";
const MODEL_CACHE = "aiglonix-models-v1";

const CACHE_FIRST_PREFIXES = ["/models/", "/ort/"];
const MEDIA_RE = /\.(mp4|webm|ogg|ogv|mp3|wav|m4a|mov)$/i;

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
  const req = event.request;
  const url = new URL(req.url);

  // Only same-origin GET. Never API, never media, never range requests
  // (video streaming uses 206 partial responses that can't be cached).
  if (req.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;
  if (req.headers.has("range")) return;
  if (MEDIA_RE.test(url.pathname)) return;

  const cacheFirst = CACHE_FIRST_PREFIXES.some((p) =>
    url.pathname.startsWith(p),
  );

  if (cacheFirst) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(MODEL_CACHE);
        const cached = await cache.match(req);
        if (cached) return cached;
        try {
          const response = await fetch(req);
          if (response.ok) cache.put(req, response.clone()).catch(() => {});
          return response;
        } catch {
          return new Response("", { status: 504, statusText: "Offline" });
        }
      })(),
    );
    return;
  }

  // network-first with cache fallback - never throws.
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const response = await fetch(req);
        if (response.ok && response.status === 200) {
          cache.put(req, response.clone()).catch(() => {});
        }
        return response;
      } catch {
        const cached = await cache.match(req);
        if (cached) return cached;
        if (req.mode === "navigate") {
          const shell =
            (await cache.match("/en")) || (await cache.match("/fr"));
          if (shell) return shell;
        }
        return new Response("", { status: 504, statusText: "Offline" });
      }
    })(),
  );
});
