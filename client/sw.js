const CACHE_NAME = 'school-battle-cache-v1';
// キャッシュするファイルのリスト
const urlsToCache = [
  '/',
  '/index.html',
  '/help.html',
  '/battle.html',
  '/result.html',
  '/css/style.css',
  '/css/help.css',
  '/css/battle.css',
  '/css/result.css',
  '/js/i18n.js',
  '/js/stats.js',
  '/js/weapons.js',
  '/js/script.js',
  '/js/online.js',
  '/js/shop.js',
  '/js/help.js',
  '/js/battle.js',
  '/js/result.js',
  '/js/skillTree.js',
  '/js/skillTreeUI.js',
  '/socket.io/socket.io.js'
  // アイコン画像などもここに追加します
  // '/images/icons/icon-192x192.png',
];

// installイベント：キャッシュにファイルを追加する
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// fetchイベント：リクエストをインターセプトし、キャッシュから返す
self.addEventListener('fetch', (event) => {
  // APIリクエストやsocket.io関連のリクエストはキャッシュしない
  if (event.request.url.includes('/api/') || event.request.url.includes('/socket.io/')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // キャッシュにあればそれを返す
        if (response) {
          return response;
        }
        // なければネットワークから取得し、キャッシュに保存して返す
        return fetch(event.request);
      })
  );
});

// activateイベント：古いキャッシュを削除する
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => Promise.all(
      cacheNames.map((cacheName) => (cacheWhitelist.indexOf(cacheName) === -1) ? caches.delete(cacheName) : null)
    ))
  );
});