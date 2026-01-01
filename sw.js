
const CACHE_NAME = 'colorswipe-v2';

// Assets to pre-cache immediately
const PRECACHE_URLS = [
  './',
  './index.html',
  // Tailwind CSS
  'https://cdn.tailwindcss.com',
  // Fonts
  'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;800&family=Courier+New:wght@700&display=swap'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Skip cross-origin requests that aren't GET or are API calls
  if (event.request.method !== 'GET' || event.request.url.includes('/rest/v1/')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request).then((response) => {
        // Check if we received a valid response
        if (!response || response.status !== 200 || response.type !== 'basic' && response.type !== 'cors') {
          return response;
        }

        // Cache the new resource (like React chunks, Lucide icons, etc.)
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return response;
      }).catch(() => {
        // Optional: Return a fallback for navigation if completely offline and not cached
        // For this app, if index.html is cached, it should load.
        return null;
      });
    })
  );
});
