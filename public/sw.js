const CACHE_NAME = 'aawsa-cache-v2';
const urlsToCache = [
  '/',
  '/manifest.json',
  '/favicon.ico',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Only intercept GET requests
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Bypass cache completely for API routes, Supabase, and auth requests
  if (url.pathname.startsWith('/api/') || url.hostname.includes('supabase') || url.pathname.includes('/auth/')) {
    return;
  }

  // Determine if it is a static asset request
  const isStaticAsset = 
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.includes('/images/') ||
    url.pathname.includes('/uploads/') ||
    url.pathname === '/favicon.ico' ||
    url.pathname === '/manifest.json';

  // Strategy for Static Assets: Cache-First, falling back to network
  if (isStaticAsset) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(event.request.clone()).then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200) {
            return networkResponse;
          }

          // Cache responses of type 'basic' or 'cors'
          if (networkResponse.type === 'basic' || networkResponse.type === 'cors') {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }

          return networkResponse;
        }).catch(() => {
          // Silent catch for network failure on static files
        });
      })
    );
    return;
  }

  // Strategy for Pages & Navigations: Network-First, falling back to cache
  event.respondWith(
    fetch(event.request.clone())
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && (networkResponse.type === 'basic' || networkResponse.type === 'cors')) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(async () => {
        // Try to match the request in the cache
        const cachedResponse = await caches.match(event.request);
        if (cachedResponse) {
          return cachedResponse;
        }

        // If offline navigation fails and page is not cached, return the cached root shell
        if (event.request.mode === 'navigate') {
          const rootCache = await caches.match('/');
          if (rootCache) {
            return rootCache;
          }
        }
      })
  );
});

// Listen for Background Sync events and notify open clients to run the page's sync
self.addEventListener('sync', (event) => {
  if (event.tag === 'offline-readings-sync') {
    event.waitUntil(
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: 'BACKGROUND_SYNC_TRIGGER' });
        });
      })
    );
  }
});

