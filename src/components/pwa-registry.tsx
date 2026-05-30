"use client";
import React, { useEffect } from 'react';

export function PwaRegistry() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    // Determine user role first
    const checkRoleAndRegister = async () => {
      // If offline, skip the role API call and proceed straight to SW registration
      // (the cached session already holds the role; the SW will serve cached pages)
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        console.info('PWA: offline – skipping role check, proceeding with SW registration');
      } else {
        try {
          const resp = await fetch('/api/user/role');
          const data = await resp.json();
          const role = data.role;
          if (role !== 'reader') {
            console.info('PWA: non‑reader role, skipping service worker registration');
            window.dispatchEvent(new CustomEvent('service-worker-unavailable'));
            return;
          }
        } catch (e) {
          // Network error or offline — fall through and register SW anyway
          console.warn('PWA: failed to fetch role (possibly offline), proceeding with registration');
        }
      }
      // Existing secure context check
      const isSecureContext =
        window.location.protocol === 'https:' ||
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        window.location.hostname === '[::1]';

      if (!isSecureContext) {
        console.warn('Service workers require a secure context (HTTPS) or localhost. Skipping registration.');
        window.dispatchEvent(new CustomEvent('service-worker-unavailable'));
        return;
      }

      const registerSW = async () => {
        try {
          const candidateUrls = [
            new URL('sw.js', document.baseURI).toString(),
            new URL('/sw.js', document.baseURI).toString(),
          ];
          let chosenSwUrl = null;
          for (const candidate of candidateUrls) {
            try {
              const resp = await fetch(candidate, { cache: 'no-store', method: 'GET' });
              const contentType = resp.headers.get('content-type') || '';
              const ok = resp.ok && !contentType.includes('text/html');
              if (ok) {
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
          console.log('ServiceWorker registration successful with scope: ', registration.scope);
        } catch (err) {
          console.error('ServiceWorker registration failed: ', err);
          window.dispatchEvent(new CustomEvent('service-worker-unavailable'));
        }
      };

      if (document.readyState === 'complete') {
        registerSW();
      } else {
        window.addEventListener('load', registerSW);
        return () => {
          window.removeEventListener('load', registerSW);
        };
      }
    };

    checkRoleAndRegister();
  }, []);
  return null;
}
