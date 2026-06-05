const CACHE_NAME = "hoppers-app-v2";
const APP_SHELL = [
  "/",
  "/index.html",
  "/styles.css",
  "/site.js",
  "/script.js",
  "/account.html",
  "/account.js",
  "/communications.html",
  "/communications.js",
  "/find-hostels.html",
  "/post-listing.html",
  "/opening-apply.html",
  "/opening-apply.js",
  "/assets/hostel-hero.png",
  "/assets/icon.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached || caches.match("/index.html")))
  );
});
