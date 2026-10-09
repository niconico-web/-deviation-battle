const CACHE_NAME = 'school-battle-cache-v70';
// キャッシュするファイルのリスト
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/battle.html',
  '/result.html',
  '/help.html',
  '/action-battle.html',
  '/stage.html',
  '/js/hw-weapons.js',
  '/js/season.js',
  '/js/beginner.js',
  '/js/stage-data.js',
  '/js/boss-moves.js',
  '/js/stage.js',
  '/js/stage-lobby.js',
  '/js/orientation.js',
  '/action-skills.html',
  '/css/style.css',
  '/css/ability-popup.css',
  '/css/avatar.css',
  '/css/battle.css',
  '/css/chat.css',
  '/css/ui-settings.css',
  '/css/dungeon.css',
  '/css/practice-coach.css',
  '/css/pvp.css',
  '/css/quest.css',
  '/css/result.css',
  '/css/study-enhanced.css',
  '/css/style-dungeon.css',
  '/css/town.css',
  '/css/tutorial.css',
  '/css/worldboss.css',
  '/js/action-battle.js',
  '/js/action-skills.js',
  '/js/avatar.js',
  '/js/battle.js',
  '/js/boss.js',
  '/js/boss_questions.js',
  '/js/chat.js',
  '/js/ui-settings.js',
  '/js/joystick.js',
  '/js/dungeon.js',
  '/js/dungeons.js',
  '/js/help.js',
  '/js/i18n.js',
  '/js/icons.js',
  '/js/loginBonus.js',
  '/js/materials.js',
  '/js/mission.js',
  '/js/monster-stats.js',
  '/js/monsters.js',
  '/js/online.js',
  '/js/orbWorkshop.js',
  '/js/party.js',
  '/js/practice-coach.js',
  '/js/pvp.js',
  '/js/questionLists.js',
  '/js/questions.js',
  '/js/quests.js',
  '/js/ranking.js',
  '/js/result.js',
  '/js/script.js',
  '/js/share.js',
  '/js/shop.js',
  '/js/skillTree.js',
  '/js/social.js',
  '/js/stats.js',
  '/js/study-enhanced.js',
  '/js/summons.js',
  '/js/tutorial-topics.js',
  '/js/tutorial.js',
  '/js/weapons.js',
  '/js/world.js',
  '/js/worldboss.js',
  '/js/ability-popup.js',
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
        // addAll は1つでも失敗（404など）すると全体が失敗し、新しいService Workerに更新されなくなる。
        // 1つずつ追加して、取得できなかったファイルだけ飛ばす。
        return Promise.all(urlsToCache.map((url) =>
          cache.add(url).catch((err) => console.warn('[SW] cache skip:', url, err && err.message))
        ));
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

  // HTML / JS / CSS はネットワーク優先（オフライン時だけキャッシュ）。
  // 以前の「キャッシュを先に返す」方式だと、更新の直後に新旧のファイルが混ざって
  // （新しいHTMLに古いJS等）、画面が「読み込み中」のまま止まることがあった。
  const reqUrl = new URL(event.request.url);
  if (event.request.method === 'GET' && (/\.(html|js|css)$/.test(reqUrl.pathname) || event.request.mode === 'navigate')) {
    event.respondWith(
      fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const copy = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => {});
        }
        return networkResponse;
      }).catch(() => caches.match(event.request).then((cached) => cached || (event.request.mode === 'navigate' ? caches.match('/index.html') : Response.error())))
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