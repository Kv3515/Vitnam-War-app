const CACHE_NAME = 'vn-history-course-v3';

const PRECACHE_URLS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './progress.js',
  './data/cards.js',
  './data/glossary.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

// Network-first, falling back to cache: while online, this always serves
// the latest deployed files and refreshes the cache in the background, so
// content updates show up without needing a manual cache-version bump.
// While offline, it falls back to whatever was cached on a previous visit,
// which is what keeps the course readable with no connection at all.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match('./index.html')))
  );
});
