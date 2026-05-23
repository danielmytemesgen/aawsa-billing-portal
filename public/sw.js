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
    event.waitUntil((async () => {
      // Attempt SW-side sync first (works even when no client open)
      try {
        // Open IndexedDB and read pending readings
        const dbOpen = indexedDB.open('AAWSAReaderDB');
        const db = await new Promise((resolve, reject) => {
          dbOpen.onsuccess = () => resolve(dbOpen.result);
          dbOpen.onerror = () => reject(dbOpen.error);
        });

        const readAllPending = () => new Promise((resolve, reject) => {
          try {
            const tx = db.transaction('readings', 'readonly');
            const store = tx.objectStore('readings');
            const req = store.getAll();
            req.onsuccess = () => {
              const all = req.result || [];
              const pending = all.filter(r => r.status === 'pending');
              resolve(pending);
            };
            req.onerror = () => reject(req.error);
          } catch (e) { reject(e); }
        });

        const pending = await readAllPending();

        // Notify clients that background sync started
        const clients = await self.clients.matchAll();
        clients.forEach((client) => client.postMessage({ type: 'BACKGROUND_SYNC_STARTED' }));

        if (pending.length > 0) {
          try {
            const resp = await fetch('/api/offline-sync', {
              method: 'POST',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ readings: pending })
            });

            if (resp && resp.ok) {
              const body = await resp.json();
              const results = body.results || [];

              // Apply results: delete successes, mark failures
              const tx = db.transaction('readings', 'readwrite');
              const store = tx.objectStore('readings');
              for (const res of results) {
                if (res.success && (res.id !== undefined && res.id !== null)) {
                  // Remove by local id if present, otherwise try by id field
                  try { store.delete(res.id); } catch (e) { /* ignore */ }
                } else if (res.id) {
                  // Mark failed
                  const getReq = store.get(res.id);
                  getReq.onsuccess = () => {
                    const rec = getReq.result;
                    if (rec) {
                      rec.status = 'failed';
                      rec.errorMessage = res.message || 'Server error';
                      store.put(rec);
                    }
                  };
                }
              }
            }
          } catch (err) {
            // Network error — let SyncManager retry later
            console.warn('SW: offline-sync POST failed:', err);
          }
        }

          // Process pending uploads (photos/blobs)
          try {
            const readAllUploads = () => new Promise((resolve, reject) => {
              try {
                const tx = db.transaction('uploads', 'readonly');
                const store = tx.objectStore('uploads');
                const req = store.getAll();
                req.onsuccess = () => {
                  const all = req.result || [];
                  const pendingUploads = all.filter(u => u.status === 'pending');
                  resolve(pendingUploads);
                };
                req.onerror = () => reject(req.error);
              } catch (e) { reject(e); }
            });

            const pendingUploads = await readAllUploads();
            if (pendingUploads.length > 0) {
              // Attempt to get device token (if any) to use Authorization header
              const getDeviceToken = async () => {
                try {
                  const tx = db.transaction('device_tokens', 'readonly');
                  const store = tx.objectStore('device_tokens');
                  const req = store.get('device');
                  const entry = await new Promise((resolve, reject) => {
                    req.onsuccess = () => resolve(req.result);
                    req.onerror = () => reject(req.error);
                  });
                  if (!entry) return null;

                  const rawKey = Uint8Array.from(atob(entry.exportedKeyBase64), c => c.charCodeAt(0));
                  const key = await crypto.subtle.importKey('raw', rawKey.buffer, 'AES-GCM', true, ['decrypt']);
                  const iv = Uint8Array.from(atob(entry.ivBase64), c => c.charCodeAt(0));
                  const cipher = Uint8Array.from(atob(entry.encryptedTokenBase64), c => c.charCodeAt(0));
                  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher.buffer);
                  return new TextDecoder().decode(plain);
                } catch (e) {
                  console.warn('SW: failed to read device token', e);
                  return null;
                }
              };

              const deviceToken = await getDeviceToken();

              for (const up of pendingUploads) {
                try {
                  const form = new FormData();
                  const blob = up.blob;
                  const filename = up.filename || 'upload.jpg';
                  form.append('file', blob, filename);

                  const headers = {};
                  if (deviceToken) headers['Authorization'] = 'Bearer ' + deviceToken;

                  const resp = await fetch('/api/upload', {
                    method: 'POST',
                    headers: Object.keys(headers).length ? headers : undefined,
                    body: form,
                    // if using token, no credentials; otherwise allow cookies
                    credentials: deviceToken ? 'omit' : 'include'
                  });

                  if (resp && resp.ok) {
                    // remove upload from IDB
                    const tx = db.transaction('uploads', 'readwrite');
                    const store = tx.objectStore('uploads');
                    try { store.delete(up.id); } catch (e) { /* ignore */ }
                  } else {
                    console.warn('SW: upload failed', resp && resp.status);
                  }
                } catch (e) {
                  console.warn('SW: upload attempt failed', e);
                }
              }
            }
          } catch (uploadErr) {
            console.error('SW: processing uploads failed', uploadErr);
          }

        // Regardless, trigger clients to run their sync logic too (keeps UI consistent)
        clients.forEach((client) => client.postMessage({ type: 'BACKGROUND_SYNC_TRIGGER' }));

      } catch (swErr) {
        console.error('SW-side sync error:', swErr);
        // Fallback: still notify clients to attempt client-side sync
        const clients = await self.clients.matchAll();
        clients.forEach((client) => client.postMessage({ type: 'BACKGROUND_SYNC_TRIGGER' }));
      }
    })());
  }
});

// Listen for messages from clients (e.g., client finished sync)
self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data && data.type === 'CLIENT_SYNC_COMPLETE') {
    const payload = { type: 'BACKGROUND_SYNC_COMPLETE', success: data.success || 0, failed: data.failed || 0 };
    event.waitUntil(
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => client.postMessage(payload));
      })
    );
  }
});

