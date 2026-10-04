// Service Worker — Trek Organizer
// Bump CACHE version whenever any app file changes.
// Uses stale-while-revalidate caching for same-origin assets so the app opens instantly
// from cache while updating assets in the background. Because updates are fetched in the
// background, code changes appear on the second load after an update.
// Developers MUST add every new app file (HTML, CSS, JS, icon) to the APP_FILES precache list
// below and bump the CACHE version whenever files are added, modified, or removed.
const CACHE = 'trek-v13';

const APP_FILES = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './js/ai.js',
  './js/app.js',
  './js/checks.js',
  './js/model.js',
  './js/share.js',
  './js/store.js',
  './js/timeline.js',
  './js/ui.js',
  './js/views/dashboard.js',
  './js/views/home.js',
  './js/views/plan.js',
  './js/views/review.js',
  './js/views/settings.js',
  './js/views/today.js',
];

// Pre-caches all app files on installation and skips waiting.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(APP_FILES))
      .then(() => self.skipWaiting())
  );
});

// Cleans up old cache stores on activation and claims clients.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

// Intercepts same-origin GET requests with stale-while-revalidate and navigation fallback.
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle GET requests
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  // Never intercept or cache requests to other origins (Ollama at localhost:11434, future weather API)
  if (url.origin !== self.location.origin) {
    return;
  }

  // Handle same-origin GET requests using stale-while-revalidate
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      // Revalidation fetch (runs in background if cached, or on demand if uncached)
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (
            networkResponse &&
            networkResponse.status === 200 &&
            networkResponse.type === 'basic'
          ) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE).then((cache) => cache.put(request, responseClone));
          }
          return networkResponse;
        })
        .catch((err) => {
          // If offline and navigating with no cached response, fallback to index.html
          if (request.mode === 'navigate') {
            return caches.match('./index.html').then((fallback) => fallback || caches.match('./'));
          }
          // If we had a cached response, background revalidation error (e.g. offline) is safely ignored
          if (cachedResponse) {
            return;
          }
          throw err;
        });

      if (cachedResponse) {
        // Keep service worker alive until background cache update finishes
        event.waitUntil(fetchPromise);
        return cachedResponse;
      }

      return fetchPromise;
    })
  );
});
