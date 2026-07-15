const CACHE_NAME = 'what-to-eat-v1';
const ASSETS = [
  'index.html',
  'manifest.json',
  'css/style.css',
  'js/app.js',
  'js/recommend.js',
  'js/storage.js',
  'js/data.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)));
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then(r => {
      return r || fetch(e.request).catch(() => {
        // Offline fallback
        if (e.request.mode === 'navigate') {
          return caches.match('index.html');
        }
      });
    })
  );
});
/**
 * @preserve
 * @license MIT
 */
