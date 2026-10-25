"use strict";

const CACHE_NAME = "omni-shell-v1.0.2";
const CACHE_PREFIX = "omni-shell-";

const INDEX_URL = new URL(
  "./index.html",
  self.registration.scope
).href;

const APP_SHELL = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

/*
 * Installation :
 * mise en cache de tous les fichiers nécessaires à l'interface.
 */
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

/*
 * Activation :
 * suppression des anciennes versions du cache de l'application.
 */
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) =>
            key.startsWith(CACHE_PREFIX) &&
            key !== CACHE_NAME
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
   * Les requêtes vers l'API Frankfurter ne sont pas interceptées.
   * Leur téléchargement, leur stockage et leur repli hors ligne
   * sont gérés dans app.js.
   */
  if (url.origin !== self.location.origin) {
    return;
  }

  /*
   * Navigation :
   * utilisation de l'interface en cache, avec un repli réseau.
   */
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

  /*
   * Autres ressources locales :
   * cache-first, puis réseau si la ressource n'est pas en cache.
   */
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

      await cache.put(
        request,
        networkResponse.clone()
      );
    }

    return networkResponse;
  })());
});
