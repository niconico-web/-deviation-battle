const CACHE_NAME = 'school-battle-cache-v17';
// キャッシュするファイルのリスト
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/battle.html',
  '/result.html',
  '/help.html',
  '/css/style.css',
  '/css/help.css',
  '/css/battle.css',
  '/css/result.css',
  '/css/ability-popup.css',
  '/js/script.js',
  '/js/stats.js',
  '/js/weapons.js',
  '/js/i18n.js',
  '/js/online.js',
  '/js/shop.js',
  '/js/skillTree.js',
  '/js/battle.js',
  '/js/ability-popup.js',
  '/js/result.js',
  '/js/help.js',
  '/js/boss.js',
  '/js/ranking.js',
  '/js/party.js',
  '/socket.io/socket.io.js',
  // アイコンのパスを修正
  '/images/icons/icon-192x192.png',
  '/images/icons/icon-512x512.png'
];

// installイベント：キャッシュにファイルを追加する
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('ServiceWorker: Caching files');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting()) // 新しいService Workerを即座に有効化
  );
});

// activateイベント：古いキャッシュを削除する
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => Promise.all(
      cacheNames.map((cacheName) => {
        if (cacheWhitelist.indexOf(cacheName) === -1) {
          console.log('ServiceWorker: Deleting old cache', cacheName);
          return caches.delete(cacheName);
        }
      })
    )).then(() => self.clients.claim()) // すべてのクライアントを制御下に置く
  );
});

self.addEventListener('fetch', (event) => {
  // chrome-extensionからのリクエストはService Workerで処理しない
  if (event.request.url.startsWith('chrome-extension://')) {
    return;
  }

  // APIとSocket.IOポーリングリクエストはネットワークに直接アクセス
  if (event.request.url.includes('/api/') || event.request.url.includes('/socket.io/?')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Handle manifest.json requests specifically
  if (event.request.url.includes('manifest.json')) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((response) => {
          if (response) {
            return response;
          }
          return fetch(event.request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          }).catch((error) => {
            console.error('[SW] Fetch error for manifest.json:', error);
            // Return a basic manifest as fallback
            return new Response(JSON.stringify({
              "name": "School Battle",
              "short_name": "SchoolBattle",
              "start_url": "/",
              "display": "standalone",
              "background_color": "#ffffff",
              "theme_color": "#000000"
            }), {
              headers: { 'Content-Type': 'application/json' }
            });
          });
        });
      })
    );
    return;
  }

  // Stale-While-Revalidate 戦略
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.match(event.request).then((response) => {
        const fetchPromise = fetch(event.request).then((networkResponse) => {
          // 有効なレスポンスのみキャッシュ（chrome-extensionを除外）
          if (networkResponse && networkResponse.status === 200) {
            // chrome-extension URLはキャッシュしない
            if (!event.request.url.startsWith('chrome-extension://')) {
              cache.put(event.request, networkResponse.clone());
            }
          }
          return networkResponse;
        }).catch((error) => {
          console.error('[SW] Fetch error:', error, event.request.url);
          // Return cached response if available on network error
          if (response) {
            return response;
          }
          throw error;
        });
        // キャッシュがあればそれを返し、なければネットワークの結果を待つ
        return response || fetchPromise;
      });
    })
  );
});
