const CACHE_NAME = 'school-battle-cache-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/battle.html',
  '/result.html',
  '/help.html',
  '/css/style.css',
  '/css/battle.css',
  '/css/help.css',
  '/css/result.css',
  '/css/ability-popup.css',
  '/js/script.js',
  '/js/stats.js',
  '/js/weapons.js',
  '/js/i18n.js',
  '/js/online.js',
  '/js/shop.js',
  '/js/skillTree.js',
  '/js/ability-popup.js',
  '/js/result.js',
  '/js/help.js',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', event => {
  // APIリクエストとsocket.io関連のリクエストはキャッシュしない
  if (event.request.url.includes('/api/') || event.request.url.includes('/socket.io/')) {
    return;
  }

  // URLクエリパラメータを無視してキャッシュを検索
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true })
      .then(response => {
        return response || fetch(event.request);
      })
  );
});