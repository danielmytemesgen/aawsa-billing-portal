"use client";

import { useEffect, useCallback } from 'react';

const INACTIVITY_TIMEOUT = 10 * 60 * 1000; // 10 minutes in milliseconds
const SESSION_EXPIRATION_KEY = 'session_expires_at';

export function useIdleTimeout(onIdle: () => void) {
  const resetTimer = useCallback(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(SESSION_EXPIRATION_KEY, String(Date.now() + INACTIVITY_TIMEOUT));
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }

    const activityEvents: (keyof WindowEventMap)[] = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll'];

    activityEvents.forEach(event => {
      window.addEventListener(event, resetTimer);
    });

    const checkInterval = setInterval(() => {
      if (typeof window !== 'undefined' && window.localStorage) {
        const expiresAt = window.localStorage.getItem(SESSION_EXPIRATION_KEY);
        
        if (expiresAt && Date.now() > Number(expiresAt)) {
          onIdle();
        }
      }
    }, 5000); // Check every 5 seconds

    return () => {
      activityEvents.forEach(event => {
        window.removeEventListener(event, resetTimer);
      });
      clearInterval(checkInterval);
    };
  }, [onIdle, resetTimer]);
}
