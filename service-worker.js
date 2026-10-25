"use strict";

// Incrémentez cette version lors d'une mise à jour importante de l'interface.
const CACHE_NAME = "omni-shell-v1.0.0";
const CACHE_PREFIX = "omni-shell-";

const INDEX_URL = new URL("./index.html", self.registration.scope).href;

const APP_SHELL = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) =>
            key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME
          )
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  /*
   * Les appels à l'API de devises ne sont pas interceptés.
   * app.js gère leur timeout, leur stockage local et leur repli hors ligne.
   */
  if (url.origin !== self.location.origin) {
    return;
  }

  // Navigation : interface cache-first, avec index.html comme repli.
  if (request.mode === "navigate") {
    event.respondWith((async () => {
      const cachedIndex = await caches.match(INDEX_URL);

      if (cachedIndex) {
        return cachedIndex;
      }

      try {
        const response = await fetch(request);

        if (response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(INDEX_URL, response.clone());
        }

        return response;
      } catch (error) {
        return new Response(
          "L’interface n’a pas encore été mise en cache.",
          {
            status: 503,
            headers: {
              "Content-Type": "text/plain; charset=utf-8"
            }
          }
        );
      }
    })());

    return;
  }

  // Autres ressources locales : cache-first, puis réseau et cache dynamique.
  event.respondWith((async () => {
    const cachedResponse = await caches.match(request);

    if (cachedResponse) {
      return cachedResponse;
    }

    const networkResponse = await fetch(request);

    if (
      networkResponse.ok &&
      networkResponse.type === "basic"
    ) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  })());
});