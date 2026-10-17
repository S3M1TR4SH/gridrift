/**
 * Generic service-worker routes. The host game supplies the cache name,
 * same-origin precache list, and platform globals. External origins are ignored.
 */
export function registerRoutes(scope, { cacheName, urls, origin }) {
  if (!scope || !cacheName || !origin || !Array.isArray(urls)) {
    throw new Error('cacheName, urls, and origin are required');
  }
  const precache = urls.slice();

  scope.addEventListener('install', (event) => {
    event.waitUntil((async () => {
      const cache = await scope.caches.open(cacheName);
      await cache.addAll(precache);
      if (typeof scope.skipWaiting === 'function') await scope.skipWaiting();
    })());
  });

  scope.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
      const keys = await scope.caches.keys();
      await Promise.all(keys.filter((key) => key !== cacheName).map((key) => scope.caches.delete(key)));
      if (scope.clients && typeof scope.clients.claim === 'function') await scope.clients.claim();
    })());
  });

  scope.addEventListener('fetch', (event) => {
    const request = event.request;
    if (!request || request.method !== 'GET') return;
    let url;
    try {
      url = new URL(request.url);
    } catch {
      return;
    }
    if (url.origin !== origin) return;

    event.respondWith((async () => {
      const cache = await scope.caches.open(cacheName);
      const cached = await cache.match(request);
      if (cached) return cached;
      const response = await scope.fetch(request);
      if (response && response.ok && response.clone) {
        await cache.put(request, response.clone());
      }
      return response;
    })());
  });
}
