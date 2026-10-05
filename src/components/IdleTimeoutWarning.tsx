'use client';

/**
 * IdleTimeoutWarning
 *
 * Monitors user activity across the entire dashboard and shows a countdown
 * dialog when the user has been idle for (warningThresholdMs) milliseconds.
 * If the user doesn't respond within the warning window, they are automatically
 * logged out to protect sensitive billing data.
 *
 * Configuration is read from the `session_settings` table via props passed
 * from the layout server component.
 *
 * Activity events tracked: mousemove, mousedown, keydown, touchstart, scroll
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { logoutAction } from '@/lib/auth-actions';
import { useRouter } from 'next/navigation';

interface IdleTimeoutWarningProps {
  /** Total idle time before auto-logout in milliseconds. Default: 30 minutes */
  idleTimeoutMs?: number;
  /** How long before timeout to show the warning dialog. Default: 5 minutes */
  warningBeforeMs?: number;
}

const DEFAULT_IDLE_TIMEOUT_MS  = 30 * 60 * 1000; // 30 minutes
const DEFAULT_WARNING_BEFORE_MS =  5 * 60 * 1000; //  5 minutes

export default function IdleTimeoutWarning({
  idleTimeoutMs   = DEFAULT_IDLE_TIMEOUT_MS,
  warningBeforeMs = DEFAULT_WARNING_BEFORE_MS,
}: IdleTimeoutWarningProps) {
  const router = useRouter();
  const [showWarning, setShowWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(Math.floor(warningBeforeMs / 1000));

  const idleTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef    = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearAllTimers = useCallback(() => {
    if (idleTimerRef.current)    clearTimeout(idleTimerRef.current);
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    if (countdownRef.current)    clearInterval(countdownRef.current);
  }, []);

  const doLogout = useCallback(async () => {
    clearAllTimers();
    try {
      await logoutAction();
    } catch { /* ignore */ }
    router.push('/');
  }, [clearAllTimers, router]);

  const startWarningCountdown = useCallback(() => {
    setShowWarning(true);
    setSecondsLeft(Math.floor(warningBeforeMs / 1000));

    countdownRef.current = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          clearInterval(countdownRef.current!);
          doLogout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [warningBeforeMs, doLogout]);

  const resetIdleTimer = useCallback(() => {
    clearAllTimers();
    setShowWarning(false);

    // Show warning (warningBeforeMs) before the idle timeout expires
    const warnAfterMs = idleTimeoutMs - warningBeforeMs;

    idleTimerRef.current = setTimeout(() => {
      startWarningCountdown();
    }, warnAfterMs);
  }, [idleTimeoutMs, warningBeforeMs, clearAllTimers, startWarningCountdown]);

  // Attach activity listeners
  useEffect(() => {
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];
    const handleActivity = () => {
      if (!showWarning) resetIdleTimer();
    };

    events.forEach(e => window.addEventListener(e, handleActivity, { passive: true }));
    resetIdleTimer(); // Start the timer on mount

    return () => {
      clearAllTimers();
      events.forEach(e => window.removeEventListener(e, handleActivity));
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showWarning]);

  const handleStayLoggedIn = () => {
    resetIdleTimer();
  };

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const timeStr = minutes > 0
    ? `${minutes}m ${seconds.toString().padStart(2, '0')}s`
    : `${secondsLeft}s`;

  if (!showWarning) return null;

  return (
    <div
      id="idle-timeout-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="idle-timeout-title"
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
      }}
    >
      <div style={{
        background: 'var(--card, #1e2436)',
        border: '1px solid var(--border, #2d3452)',
        borderRadius: 16,
        padding: '2rem 2.5rem',
        maxWidth: 420, width: '90%',
        textAlign: 'center',
        boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
      }}>
        {/* Icon */}
        <div style={{ fontSize: 48, marginBottom: 12 }}>⏱️</div>

        <h2 id="idle-timeout-title" style={{
          margin: '0 0 8px', fontSize: '1.25rem', fontWeight: 700,
          color: 'var(--foreground, #f0f4ff)',
        }}>
          Session Expiring Soon
        </h2>

        <p style={{ color: 'var(--muted-foreground, #8892b0)', marginBottom: 20, lineHeight: 1.6 }}>
          You have been inactive. For security, you will be automatically
          signed out in:
        </p>

        {/* Countdown */}
        <div style={{
          fontSize: '2.5rem', fontWeight: 800,
          color: secondsLeft <= 60 ? '#ef4444' : '#f59e0b',
          marginBottom: 24, fontVariantNumeric: 'tabular-nums',
        }}>
          {timeStr}
        </div>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button
            id="idle-timeout-logout-btn"
            onClick={doLogout}
            style={{
              padding: '10px 20px', borderRadius: 8, border: 'none',
              background: '#374151', color: '#e5e7eb', cursor: 'pointer',
              fontSize: '0.9rem', fontWeight: 500,
            }}
          >
            Sign Out Now
          </button>

          <button
            id="idle-timeout-stay-btn"
            onClick={handleStayLoggedIn}
            style={{
              padding: '10px 24px', borderRadius: 8, border: 'none',
              background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
              color: '#fff', cursor: 'pointer',
              fontSize: '0.9rem', fontWeight: 600,
            }}
          >
            Stay Logged In
          </button>
        </div>
      </div>
    </div>
  );
}
