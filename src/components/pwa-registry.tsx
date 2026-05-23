"use client";
import React, { useEffect } from 'react';

export function PwaRegistry() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const isSecureContext =
      window.location.protocol === 'https:' ||
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname === '[::1]';

    if (!isSecureContext) {
      console.warn('Service workers require a secure context (HTTPS) or localhost. Skipping registration.');
      // Dispatch an event so the app can fallback gracefully when SW isn't available (HTTP)
      window.dispatchEvent(new CustomEvent('service-worker-unavailable'));
      return;
    }

    const registerSW = async () => {
      try {
        // Use a relative sw path so deployments under a basePath/subpath work
        const swUrl = new URL('sw.js', document.baseURI).toString();
        // Use the sw file's directory as the scope (ensures subpath deployments work)
        const scope = new URL('.', swUrl).pathname || '/';

        // Emit resolved values to assist debugging in production
        console.info('PWA: resolved swUrl and scope for registration', { swUrl, scope });

        // Lightweight runtime check to verify the sw file is reachable and served as JS
        try {
          const resp = await fetch(swUrl, { cache: 'no-store', method: 'GET' });
          const contentType = resp.headers.get('content-type') || '';
          const ok = resp.ok && !contentType.includes('text/html');
          window.dispatchEvent(new CustomEvent('service-worker-check', { detail: { ok, status: resp.status, contentType, swUrl, scope } }));
          if (!ok) {
            console.warn('PWA: /sw.js reachable check failed', { status: resp.status, contentType, swUrl });
          }
        } catch (fetchErr) {
          console.warn('PWA: failed to fetch sw.js for verification', fetchErr, { swUrl, scope });
          window.dispatchEvent(new CustomEvent('service-worker-check', { detail: { ok: false, error: String(fetchErr), swUrl, scope } }));
        }

        const registration = await navigator.serviceWorker.register(swUrl, { scope });
        console.log('ServiceWorker registration successful with scope: ', registration.scope);
      } catch (err) {
        console.error('ServiceWorker registration failed: ', err);
        window.dispatchEvent(new CustomEvent('service-worker-check', { detail: { ok: false, error: String(err) } }));
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
  }, []);
  return null;
}

