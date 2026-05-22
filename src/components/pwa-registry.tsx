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
        const swUrl = new URL('/sw.js', document.baseURI).toString();
        // Use the sw file's directory as the scope (ensures subpath deployments work)
        const scope = new URL('.', swUrl).pathname || '/';
        const registration = await navigator.serviceWorker.register(swUrl, { scope });
        console.log('ServiceWorker registration successful with scope: ', registration.scope);
      } catch (err) {
        console.error('ServiceWorker registration failed: ', err);
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

