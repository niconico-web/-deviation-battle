'use strict';

// Keep installation lightweight. Large game modules are cached on first use,
// rather than downloading the entire game before the service worker activates.
const CACHE_NAME = 'school-battle-cache-v111';
const SHELL_ASSETS = ['/manifest.json', '/css/style.css'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => Promise.all(SHELL_ASSETS.map(url =>
        cache.add(url).catch(error => console.warn('[SW] shell cache skip:', url, error?.message))
      )))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(names => Promise.all(names.filter(name => name !== CACHE_NAME).map(name => caches.delete(name))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // APIs and Socket.IO must always use the live server.
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/socket.io/')) {
    event.respondWith(fetch(request));
    return;
  }

  // HTML can contain deployment-specific values, so prefer the network and
  // fall back to cache only when offline.
  if (request.mode === 'navigate' || /\.html$/i.test(url.pathname) || url.pathname === '/') {
    event.respondWith(
      fetch(request).then(response => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy)).catch(() => {});
        }
        return response;
      }).catch(() => caches.match(request).then(cached => cached || caches.match('/index.html') || Response.error()))
    );
    return;
  }

  // JS/CSS/images: return the cached asset immediately, then refresh it in the
  // background. This avoids a network round-trip on every screen/module visit.
  event.respondWith(
    caches.open(CACHE_NAME).then(async cache => {
      const cached = await cache.match(request);
      const update = fetch(request).then(response => {
        if (response.ok) cache.put(request, response.clone()).catch(() => {});
        return response;
      });
      if (cached) {
        event.waitUntil(update.catch(() => {}));
        return cached;
      }
      return update.catch(() => Response.error());
    })
  );
});
