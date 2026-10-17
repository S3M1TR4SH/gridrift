import { CACHE_NAME, PRECACHE_URLS } from './src/precache.js';
import { registerRoutes } from './studio-core/pwa/sw.js';

if (typeof ServiceWorkerGlobalScope !== 'undefined') {
  registerRoutes(self, {
    cacheName: CACHE_NAME,
    urls: PRECACHE_URLS,
    origin: self.location.origin
  });
}
