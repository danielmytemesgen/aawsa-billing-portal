"use client";
import React, { useEffect } from 'react';

export function PwaRegistry() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const registerSW = async () => {
      try {
        const candidateUrls = [
          new URL('sw.js', document.baseURI).toString(),
          new URL('/sw.js', document.baseURI).toString(),
        ];
        let chosenSwUrl: string | null = null;
        for (const candidate of candidateUrls) {
          try {
            const resp = await fetch(candidate, { cache: 'no-store', method: 'GET' });
            const contentType = resp.headers.get('content-type') || '';
            if (resp.ok && !contentType.includes('text/html')) {
              chosenSwUrl = candidate;
              break;
            }
          } catch {}
        }
        if (!chosenSwUrl) {
          console.error('PWA: no valid sw.js found; skipping registration');
          window.dispatchEvent(new CustomEvent('service-worker-unavailable'));
          return;
        }
        const scope = new URL('.', chosenSwUrl).pathname || '/';
        const registration = await navigator.serviceWorker.register(chosenSwUrl, { scope });
        console.log('ServiceWorker registered with scope:', registration.scope);

        // Listen for SW updates so we can notify the user or reload silently
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New SW installed — tell it to take over immediately
                newWorker.postMessage({ type: 'SKIP_WAITING' });
              }
            });
          }
        });

        // When a new SW takes over, deep-cache the current page assets again
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          console.log('PWA: new service worker activated');
        });

      } catch (err) {
        console.error('ServiceWorker registration failed:', err);
        window.dispatchEvent(new CustomEvent('service-worker-unavailable'));
      }
    };

    const checkRoleAndRegister = async () => {
      // Always register when offline — the SW is needed to serve cached login page + JS
      if (!navigator.onLine) {
        console.info('PWA: offline – registering SW unconditionally for cached page access');
        if (document.readyState === 'complete') registerSW();
        else window.addEventListener('load', registerSW, { once: true });
        return;
      }

      // Online: check role. Register for readers; also register for unauthenticated
      // users (so the login page gets its JS cached for future offline use).
      try {
        const resp = await fetch('/api/user/role');
        if (!resp.ok) throw new Error('no role');
        const data = await resp.json();
        const role = (data.role || '').toLowerCase();
        if (role && role !== 'reader') {
          // Admin / management users don't need offline SW
          console.info('PWA: non-reader role, skipping SW registration');
          window.dispatchEvent(new CustomEvent('service-worker-unavailable'));
          return;
        }
      } catch (e) {
        // Unauthenticated or network error — register anyway so login page caches JS
        console.info('PWA: role check failed (unauthenticated or error), registering SW for login page caching');
      }

      if (document.readyState === 'complete') registerSW();
      else window.addEventListener('load', registerSW, { once: true });
    };

    checkRoleAndRegister();
  }, []);
  return null;
}
