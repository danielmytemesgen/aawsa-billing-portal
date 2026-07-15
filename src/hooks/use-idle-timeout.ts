
import { useEffect, useCallback } from 'react';

const SESSION_EXPIRATION_KEY = 'session_expires_at';
const SESSION_DURATION_SECONDS_KEY = 'aawsa-session-duration-seconds';
const SESSION_WARNING_SECONDS_KEY = 'aawsa-session-warning-seconds';

interface IdleTimeoutOptions {
  onIdle: () => void;
  onWarn?: (secondsLeft: number) => void;
}

export function useIdleTimeout({ onIdle, onWarn }: IdleTimeoutOptions) {
  const resetTimer = useCallback(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      // Read configured duration (seconds) from localStorage, fallback to 600 seconds (10 minutes)
      const secondsStr = window.localStorage.getItem(SESSION_DURATION_SECONDS_KEY);
      const seconds = secondsStr ? Number(secondsStr) : undefined;
      const timeoutMs = !isNaN(Number(seconds)) && seconds! > 0 ? seconds! * 1000 : 10 * 60 * 1000;
      window.localStorage.setItem(SESSION_EXPIRATION_KEY, String(Date.now() + timeoutMs));
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

      // Determine warning window from configured setting
      const warningSecondsStr = window.localStorage.getItem(SESSION_WARNING_SECONDS_KEY);
      const warningMs = warningSecondsStr ? Number(warningSecondsStr) * 1000 : 2 * 60 * 1000;

      if (msLeft <= 0) {
        // Session expired → logout
        onIdle();
      } else if (msLeft <= warningMs) {
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
