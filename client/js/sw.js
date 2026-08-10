const CACHE_NAME = 'school-battle-cache-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/battle.html',
  '/result.html',
  '/css/style.css',
  '/css/battle.css',
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
  // Add your icon paths here
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
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});