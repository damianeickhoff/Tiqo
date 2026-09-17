// Deliberately minimal. Tiqo shows per-user, permission-filtered data, so
// caching HTML responses risks serving one person's queue to another. This
// worker exists to make the app installable and to fail gracefully offline —
// nothing more. Add caching only for genuinely public, versioned assets.

const OFFLINE_URL = "/offline.html";
const CACHE = "tiqo-shell-v1";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.add(OFFLINE_URL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;

  event.respondWith(fetch(event.request).catch(() => caches.match(OFFLINE_URL)));
});
