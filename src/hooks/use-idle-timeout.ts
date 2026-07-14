
import { useEffect, useCallback } from 'react';

const INACTIVITY_TIMEOUT = 10 * 60 * 1000; // 10 minutes
const WARNING_BEFORE    =  2 * 60 * 1000;  // warn 2 minutes before expiry
const SESSION_EXPIRATION_KEY = 'session_expires_at';

interface IdleTimeoutOptions {
  onIdle: () => void;
  onWarn?: (secondsLeft: number) => void;
}

export function useIdleTimeout({ onIdle, onWarn }: IdleTimeoutOptions) {
  const resetTimer = useCallback(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(SESSION_EXPIRATION_KEY, String(Date.now() + INACTIVITY_TIMEOUT));
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }

    // Initialise expiry if not already set
    if (!window.localStorage.getItem(SESSION_EXPIRATION_KEY)) {
      resetTimer();
    }

    const activityEvents: (keyof WindowEventMap)[] = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll'];
    activityEvents.forEach(event => window.addEventListener(event, resetTimer));

    const checkInterval = setInterval(() => {
      if (typeof window === 'undefined' || !window.localStorage) return;

      const expiresAt = window.localStorage.getItem(SESSION_EXPIRATION_KEY);
      if (!expiresAt) return;

      const msLeft = Number(expiresAt) - Date.now();

      if (msLeft <= 0) {
        // Session expired → logout
        onIdle();
      } else if (msLeft <= WARNING_BEFORE) {
        // Within warning window → notify with seconds remaining
        onWarn?.(Math.ceil(msLeft / 1000));
      }
    }, 5000); // Check every 5 seconds

    return () => {
      activityEvents.forEach(event => window.removeEventListener(event, resetTimer));
      clearInterval(checkInterval);
    };
  }, [onIdle, onWarn, resetTimer]);

  return { resetTimer };
}
