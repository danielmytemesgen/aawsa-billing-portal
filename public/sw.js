const CACHE_NAME = 'aawsa-cache-v4';
const CORE_PAGES = ['/', '/manifest.json'];

/**
 * Fetches an HTML page, parses all /_next/static script src + link href
 * attributes, and caches every asset found. This ensures the JS bundles
 * that React needs to hydrate are available when offline.
 */
async function deepCachePage(cache, pageUrl) {
  try {
    const res = await fetch(pageUrl, { credentials: 'same-origin' });
    if (!res || !res.ok) return;
    const html = await res.clone().text();
    await cache.put(pageUrl, res);

    // Collect all /_next/static/ script and stylesheet URLs from the HTML
    const assetUrls = new Set();
    for (const m of html.matchAll(/<script[^>]+src=["']([^"']+)["']/g)) {
      if (m[1] && m[1].startsWith('/_next/')) assetUrls.add(m[1]);
    }
    for (const m of html.matchAll(/<link[^>]+href=["']([^"']+\.css[^"']*)["']/g)) {
      if (m[1] && m[1].startsWith('/_next/')) assetUrls.add(m[1]);
    }

    // Cache each asset individually — a single failure won't abort the rest
    await Promise.allSettled(
      [...assetUrls].map(async (url) => {
        try {
          const already = await cache.match(url);
          if (already) return; // skip if already cached
          const r = await fetch(url, { credentials: 'same-origin' });
          if (r && r.ok) await cache.put(url, r);
        } catch (e) {
          console.warn('SW Install: failed to cache asset', url, e);
        }
      })
    );
  } catch (e) {
    console.warn('SW Install: deepCachePage failed for', pageUrl, e);
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      // Deep-cache the login page (/) so its JS bundles are available offline
      await deepCachePage(cache, '/');
      // Cache any remaining simple URLs
      for (const url of CORE_PAGES) {
        try {
          const already = await cache.match(url);
          if (!already) await cache.add(url);
        } catch (e) {
          console.warn('SW Install: failed to cache', url, e);
        }
      }
      return self.skipWaiting();
    })()
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

  // Bypass cache completely for API routes and auth requests
  if (url.pathname.startsWith('/api/') || url.pathname.includes('/auth/')) {
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
        }).catch(async () => {
          // Offline and not in cache — return error so browser handles it gracefully
          const cached = await caches.match(event.request);
          return cached || Response.error();
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
          
          // Fallback if root cache is missing to avoid ERR_EMPTY_RESPONSE
          return new Response(
            '<html><head><title>Offline</title><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="font-family:sans-serif;padding:2rem;text-align:center;"><h2>You are offline</h2><p>Please check your internet connection and try again.</p></body></html>',
            { headers: { 'Content-Type': 'text/html' } }
          );
        }
        
        return Response.error();
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

              // #region agent log
              fetch('http://127.0.0.1:7788/ingest/11f0b13b-2903-4f1e-876b-3b02fed3705a',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'7b1771'},body:JSON.stringify({sessionId:'7b1771',runId:'pre-fix',hypothesisId:'A',location:'sw.js:sync-results',message:'SW offline-sync response fields',data:{resultCount:results.length,sample:results.slice(0,3).map(r=>({success:r.success,id:r.id,localId:r.localId,serverId:r.serverId}))},timestamp:Date.now()})}).catch(()=>{});
              // #endregion

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

              // Attempt to get device token (if any) to use Authorization header via refresh
              const getDeviceAccessToken = async () => {
                try {
                  const tx = db.transaction('device_tokens', 'readonly');
                  const store = tx.objectStore('device_tokens');
                  const reqAll = store.getAll();
                  const entries = await new Promise((resolve, reject) => {
                    reqAll.onsuccess = () => resolve(reqAll.result || []);
                    reqAll.onerror = () => reject(reqAll.error);
                  });
                  const all = entries || [];
                  if (!all.length) return null;

                  // Choose latest by timestamp
                  all.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
                  const entry = all[0];

                  // If plaintext token stored for tests
                  if (entry.token) {
                    // Exchange raw token for access token
                    const r = await fetch('/api/device/refresh', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ token: entry.token })
                    });
                    if (r && r.ok) {
                      const jb = await r.json();
                      return jb.accessToken || null;
                    }
                    return null;
                  }

                  // Otherwise decrypt stored AES-GCM encrypted token
                  const rawKey = Uint8Array.from(atob(entry.exportedKeyBase64), c => c.charCodeAt(0));
                  const key = await crypto.subtle.importKey('raw', rawKey.buffer, 'AES-GCM', true, ['decrypt']);
                  const iv = Uint8Array.from(atob(entry.ivBase64), c => c.charCodeAt(0));
                  const cipher = Uint8Array.from(atob(entry.encryptedTokenBase64), c => c.charCodeAt(0));
                  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher.buffer);
                  const rawToken = new TextDecoder().decode(plain);

                  // Exchange raw token for access token
                  const refreshResp = await fetch('/api/device/refresh', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token: rawToken })
                  });
                  if (refreshResp && refreshResp.ok) {
                    const jb = await refreshResp.json();
                    return jb.accessToken || null;
                  }
                  return null;
                } catch (e) {
                  console.warn('SW: failed to read/refresh device token', e);
                  return null;
                }
              };

              const accessToken = await getDeviceAccessToken();

              for (const up of pendingUploads) {
                try {
                  const blob = up.blob;
                  const filename = up.filename || 'upload.jpg';
                  const CHUNK_SIZE = 1024 * 1024; // 1 MB

                  // If large blob, perform chunked upload with retries
                  if (blob && blob.size && blob.size > CHUNK_SIZE) {
                    const totalChunks = Math.ceil(blob.size / CHUNK_SIZE);
                    const initResp = await fetch('/api/upload/initiate', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ filename, totalChunks })
                    });
                    const initJson = await initResp.json();
                    const uploadId = initJson.uploadId;

                    for (let i = 0; i < totalChunks; i++) {
                      const start = i * CHUNK_SIZE;
                      const end = Math.min(start + CHUNK_SIZE, blob.size);
                      const chunk = blob.slice(start, end);
                      const chunkBuf = await chunk.arrayBuffer();

                      let attempt = 0;
                      const maxAttempts = 5;
                      let ok = false;
                      while (!ok && attempt < maxAttempts) {
                        try {
                          const params = new URLSearchParams({ uploadId, index: String(i) });
                          const r = await fetch('/api/upload/chunk?' + params.toString(), {
                            method: 'POST',
                            body: chunkBuf,
                            headers: { 'Content-Type': 'application/octet-stream', ...(accessToken ? { Authorization: 'Bearer ' + accessToken } : {}) },
                            credentials: accessToken ? 'omit' : 'include'
                          });
                          if (!r.ok) throw new Error('chunk failed ' + i + ' status:' + r.status);
                          ok = true;
                        } catch (e) {
                          attempt++;
                          const backoff = Math.min(30000, Math.pow(2, attempt) * 500 + Math.random() * 200);
                          await new Promise(res => setTimeout(res, backoff));
                        }
                      }
                      if (!ok) throw new Error('chunk upload failed after retries ' + i);
                    }

                    // complete
                    const comp = await fetch('/api/upload/complete', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ uploadId })
                    });
                    const compJson = await comp.json();
                    if (comp && comp.ok && compJson && compJson.url) {
                      const tx = db.transaction('uploads', 'readwrite');
                      const store = tx.objectStore('uploads');
                      try { store.delete(up.id); } catch (e) { }
                      try { fetch('/api/offline/metrics', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event: 'upload_chunked_success', details: { filename, uploadId, size: blob.size } }) }); } catch (e) {}
                    } else {
                      throw new Error('complete failed');
                    }
                  } else {
                    // Small file: single request with retry/backoff
                    let attempt = 0;
                    const maxAttempts = 4;
                    let success = false;
                    while (!success && attempt < maxAttempts) {
                      try {
                        const form = new FormData();
                        form.append('file', blob, filename);
                        const headers = {};
                        if (accessToken) headers['Authorization'] = 'Bearer ' + accessToken;
                        const resp = await fetch('/api/upload', {
                          method: 'POST',
                          headers: Object.keys(headers).length ? headers : undefined,
                          body: form,
                          credentials: accessToken ? 'omit' : 'include'
                        });
                        if (resp && resp.ok) {
                          const tx = db.transaction('uploads', 'readwrite');
                          const store = tx.objectStore('uploads');
                          try { store.delete(up.id); } catch (e) { }
                          try { fetch('/api/offline/metrics', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event: 'upload_success', details: { filename, size: blob ? blob.size : 0 } }) }); } catch (e) {}
                          success = true;
                        } else {
                          attempt++;
                          const backoff = Math.min(20000, Math.pow(2, attempt) * 300 + Math.random() * 200);
                          await new Promise(res => setTimeout(res, backoff));
                        }
                      } catch (e) {
                        attempt++;
                        const backoff = Math.min(20000, Math.pow(2, attempt) * 300 + Math.random() * 200);
                        await new Promise(res => setTimeout(res, backoff));
                      }
                    }
                    if (!success) console.warn('SW: upload failed after retries');
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

  // Allow client to trigger immediate SW activation after update
  if (data && data.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }

  if (data && data.type === 'CLIENT_SYNC_COMPLETE') {
    const payload = { type: 'BACKGROUND_SYNC_COMPLETE', success: data.success || 0, failed: data.failed || 0 };
    event.waitUntil(
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => client.postMessage(payload));
      })
    );
  }
});
