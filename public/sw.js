// [DEVELOPER] Bump this version whenever you push a new release to GitHub.
// This ensures the browser detects an update and triggers the refresh logic.
const VERSION = '1.0.4';
const CACHE_NAME = `unburdened-v${VERSION}`;

const PRECACHE_ASSETS = [
  '/unburdened/',
  '/unburdened/index.html',
  '/unburdened/manifest.json',
  '/unburdened/icons/icon-192.png',
  '/unburdened/icons/icon-512.png',
  '/unburdened/icons/icon-maskable-512.png',
];

self.addEventListener('message', (event) => {
  if (event.data?.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: VERSION });
  }
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_ASSETS))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Never intercept OPFS or cross-origin requests (AI model lives in OPFS, not cache)
  if (event.request.url.includes('model') || !url.origin === self.location.origin) {
    return;
  }

  // Cache-first for same-origin static assets
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response && response.status === 200 && event.request.method === 'GET') {
          const cloned = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, cloned));
        }
        return response;
      }).catch(() => {
        // Offline fallback for navigation requests
        if (event.request.mode === 'navigate') {
          return caches.match('/unburdened/');
        }
      });
    })
  );
});
