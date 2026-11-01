"use strict";

const CACHE_NAME = "omni-calculateur-v1.3.0";
const CACHE_PREFIX = "omni-calculateur-";

/*
 * Anciens caches des versions 1.2 et avant, aux noms trop généraux
 * (« omni-shell-… », « omni-fonts-v1 ») : effacés à l'activation.
 * Toutes les applications du site partagent le même espace de caches,
 * d'où un nom propre au Calculateur.
 */
const ANCIENS_CACHES = (key) => key.startsWith("omni-shell-") || key === "omni-fonts-v1";

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
  "./icons/icon-512.png",
  "./oxanium.woff2",
  "./literata.woff2",
  "./jetbrains-mono.woff2"
];

/*
 * Installation :
 * mise en cache de tous les fichiers nécessaires à l'interface.
 * Une nouvelle version attend ensuite que l'utilisateur appuie sur
 * « Mettre à jour » (voir le message SKIP_WAITING plus bas), pour ne
 * pas changer l'application pendant qu'il s'en sert.
 */
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      /*
       * « reload » contourne le cache HTTP du navigateur : sans cela,
       * une nouvelle version pouvait enregistrer d'anciens fichiers.
       */
      .then((cache) => cache.addAll(
        APP_SHELL.map((url) => new Request(url, { cache: "reload" }))
      ))
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
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
            (key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME) ||
            ANCIENS_CACHES(key)
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
      const cachedIndex = await (await caches.open(CACHE_NAME)).match(INDEX_URL);

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
    // Seulement dans le cache du Calculateur (pas celui d'une autre application).
    const cachedResponse = await (await caches.open(CACHE_NAME)).match(request);

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
