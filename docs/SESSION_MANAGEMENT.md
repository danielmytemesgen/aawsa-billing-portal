# Session Management — AAWSA Billing Portal

## Overview

Sessions protect staff accounts from unauthorized access. The portal uses signed JWT cookies that expire automatically. An idle timeout also signs users out if they leave the application unattended.

---

## Session Lifetime

| Setting | Default | Configurable |
|---|---|---|
| **Session duration** | 2 hours (7200 s) | Yes — `session_settings` table |
| **Idle timeout** | 30 minutes | Yes — `IdleTimeoutWarning` props |
| **Warning before logout** | 5 minutes | Yes — `IdleTimeoutWarning` props |

The session duration is read at login time from the `session_settings` table:

```sql
SELECT session_duration_seconds FROM session_settings ORDER BY id DESC LIMIT 1;

-- To change: (requires re-login to take effect)
UPDATE session_settings SET session_duration_seconds = 14400; -- 4 hours
```

---

## Idle Timeout Behavior

1. User is active → 30-minute idle timer resets on every mouse/keyboard/touch event
2. User is idle for **25 minutes** → Warning dialog appears with a **5-minute countdown**
3. User clicks **"Stay Logged In"** → Timer resets, session continues
4. User clicks **"Sign Out Now"** → Immediate logout
5. Countdown reaches **0** → Automatic logout and redirect to login page

---

## Session Security

- Cookies are **HttpOnly** (cannot be read by JavaScript — prevents XSS theft)
- Cookies are **Secure** in production (HTTPS only)
- Cookies use **SameSite=Lax** (CSRF protection)
- Sessions are **server-revocable** — admins can sign out any staff member via the Staff Sessions page
- Session revocation takes effect **immediately** on the next request

---

## Force-Logout a Staff Member (Admin)

1. Go to **Admin → Staff Management → Sessions**
2. Find the active session
3. Click **Revoke Session**

Or via SQL:
```sql
-- Find active sessions
SELECT id, staff_email, login_time, last_active_at, ip_address
FROM staff_sessions
WHERE logout_time IS NULL
ORDER BY login_time DESC;

-- Revoke a session
UPDATE staff_sessions
SET logout_time = NOW(), session_end_reason = 'admin_revoked'
WHERE id = '<session-uuid>';
```

---

## Session Monitoring

Every login creates a `staff_sessions` row that tracks:
- Login time and IP address
- Device type (Windows / Mobile / macOS)
- Pages visited
- Duration
- Logout reason (logout / idle / admin_revoked / session_expired)

View in: **Admin → Staff Sessions**

---

## Implementation Files

| File | Purpose |
|---|---|
| [`src/lib/auth.ts`](../src/lib/auth.ts) | `getSession()`, `updateSession()` |
| [`src/lib/auth-actions.ts`](../src/lib/auth-actions.ts) | `loginAction()`, `logoutAction()` |
| [`src/components/IdleTimeoutWarning.tsx`](../src/components/IdleTimeoutWarning.tsx) | Idle timeout countdown UI |
| [`src/app/providers.tsx`](../src/app/providers.tsx) | Global mount of IdleTimeoutWarning |
| [`src/lib/session-revocation.ts`](../src/lib/session-revocation.ts) | Admin revoke logic |
