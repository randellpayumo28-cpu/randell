const CACHE_NAME = "dells-bag-co-v2";

// Only files we know exist and won't change name are pre-cached on install.
// Vite's built JS/CSS get hashed filenames (e.g. assets/index-a1b2c3.js) that
// we can't predict ahead of time, so those are cached at runtime instead,
// the first time they're actually requested (see the fetch handler below).
const PRECACHE_URLS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/favicon.svg",
  "/icons.svg",
  "/image/192x192.png",
  "/image/512x512.png",
];

self.addEventListener("install", (event) => {
  console.log("Service Worker: Installing...");

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("Caching app shell...");
      return Promise.all(
        PRECACHE_URLS.map((url) =>
          cache.add(url).catch((err) => {
            console.warn("Failed to cache:", url, err);
          })
        )
      );
    })
  );

  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  console.log("Service Worker: Activated...");

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );

  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

  // Navigations (typing a URL, refreshing /shop, /orders, etc.) need to
  // resolve to index.html so React Router can take over client-side —
  // there's no real /shop page on the server. Try the network first so
  // people online always get the latest shell; fall back to the cached
  // shell when offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          const copy = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put("/index.html", copy));
          return networkResponse;
        })
        .catch(() => caches.match("/index.html"))
    );
    return;
  }

  // Everything else (hashed JS/CSS bundles, product images, icons, fonts):
  // serve from cache instantly if we have it, and in the background fetch
  // a fresh copy from the network to update the cache for next time. If
  // there's nothing cached yet, wait on the network and cache what comes
  // back so it's available offline afterwards.
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const networkFetch = fetch(request)
        .then((networkResponse) => {
          // Cache successful responses, including opaque cross-origin ones
          // (e.g. the Unsplash product photos) — we just can't inspect
          // their status, so cache them as-is.
          if (networkResponse && (networkResponse.ok || networkResponse.type === "opaque")) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return networkResponse;
        })
        .catch(() => {
          console.warn("Fetch failed, walang cache at walang net:", request.url);
          return cachedResponse;
        });

      return cachedResponse || networkFetch;
    })
  );
});
