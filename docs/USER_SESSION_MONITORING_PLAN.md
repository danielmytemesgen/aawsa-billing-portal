# User Login / Session Monitoring — Implementation Plan

**Goal:** extend the **Security Logs** page (`/admin/security-logs`) so admins can monitor **who logs in, when, for how long, and what they viewed** — for both staff and customers.

Tracked per session:
- **Login time** (session start)
- **Logout time** (session end — explicit logout, kick-out, idle timeout, or expiry)
- **Amount of time used** (duration = logout − login; live `now − login` while active)
- **Pages viewed** (path + label + timestamp, not just a deduped name list)
- **Related metadata**: user, role, branch, IP address, device / user-agent, status (active / logged out / expired / revoked)

---

## 1. Current state (audited)

| Area | What exists today | Gap |
|---|---|---|
| Staff auth (`src/lib/auth-actions.ts`) | `loginAction` creates a JWT cookie (`session`) with `expires`; `logoutAction` clears the cookie. No DB row. | **No record at all of staff login/logout time, duration, or pages viewed.** |
| Staff session lifecycle | JWT is stateless; idle timeout (`useIdleTimeout` in `app-shell.tsx`) calls `logoutAction`. **`encrypt()` in `src/lib/session.ts` hardcodes `.setExpirationTime("2h")`** — the configured `session_duration_seconds` only lands in the payload's `expires` field (used client-side for warnings), so the real JWT always dies 2h after issue. | No way to see a staff member's session history or who is currently logged in. (Pre-existing divergence: sessions configured >2h still die at the 2h JWT expiry.) |
| Customer sessions (`customer_sessions` table, raw SQL — not in `src/lib/schema.ts`) | `created_at`, `last_active_at`, `pages_viewed` (text[], deduped by page name), `is_revoked`, `ip_address`, `device_name`, `location`. Created in `createCustomerSessionAction`, revoked in `revokeCustomerSessionAction`. | No `logout_time`, no duration, no page-view **timestamps**; page only shows **active** sessions (`WHERE is_revoked = false`) — no history. |
| Page-view tracking | Customer: client-side fire-and-forget `POST /api/customer/log-page-view` from `customer/layout.tsx`, deduped per client session. Staff: none. | Staff pages not tracked; customer tracking loses repeat visits and timestamps. |
| Security logs (`security_logs`) | `dbLogSecurityEvent` records `Unauthorized Access Attempt` / `Permission Denied` (from `wrap()` in `src/lib/actions.ts`) plus manual events. **Customer events already exist**: `createCustomerSessionAction` logs `Customer Login`; `revokeCustomerSessionAction` logs `Customer Session Revoked`. | No **staff** login-success / login-failure / logout / expiry events. |
| Migration tooling | Pattern: `pg` Client + `POSTGRES_*` env vars + reads a `.sql` file (`scripts/migrations/run_customer_portal_migration.js`, `database/run-migration.ts`, `scripts/tools/run-migration.js`). **`*.sql` is gitignored repo-wide** (`.gitignore` line ~53), which is why none of the referenced SQL files exist in this checkout — the convention is that migration SQL lives on the dev/deploy machine, not in git. | New migration adds a runner (tracked) + a `.sql` file (untracked by convention — copy it to fresh checkouts like `.env.local`; the runner prints a clear error when it's missing). |
| Page & API | `src/app/(dashboard)/admin/security-logs/page.tsx` (tabs: Security Logs, Customer Sessions) + `/api/route.ts` (paged, sortable, branch-isolated). | Need a third tab (or upgraded sessions tab) + new API endpoints. |

## 2. Design decisions

1. **Keep the two session stores separate; unify at the query layer.**
   - New **`staff_sessions`** table (staff have no session store today).
   - **Augment `customer_sessions`** with `logout_time`, `duration_seconds`, `session_end_reason` — additive columns, so existing customer code keeps working untouched.
   - The monitoring page queries a single endpoint that UNIONs both (type discriminator: `staff` / `customer`).

2. **Staff session id goes into the JWT.** `loginAction` inserts a `staff_sessions` row and embeds `sessionId` in the token payload (alongside the existing `id`/`email`/`role` claims). Every authenticated request can then attribute itself to a session row. `decrypt`/`getSession` keep returning the same shape plus `sessionId`.

3. **Status is derived, not stored as an enum column:**
   - `active` → `logout_time IS NULL`
   - `logged_out` / `revoked` / `expired` → `session_end_reason` set by the event that ended it (`logout`, `kickout`, `idle_timeout`, `expired`, `revoked`).
   - This avoids drift between `is_revoked` and a status column.

4. **Page views become timestamped events.** Store as `jsonb` array of `{ path, label, viewed_at }` — repeat visits are kept (dedupe only consecutive identical paths). Heartbeat (`last_active_at`) updates are throttled (e.g. every 60s) to avoid write amplification.

5. **Login/logout events also land in `security_logs`** (`info` severity) so the existing Security Logs tab shows them: `Staff Login Success`, `Staff Login Failed`, `Staff Logout`, `Session Expired`, `Session Revoked` (customer kick-out). Do **not** add a new `Customer Login` event — `createCustomerSessionAction` already logs it. Note `logSecurityEventAction` runs with `getSession()`; for customer-originated events the staff email is `System`, and it must keep working when no staff session exists.

6. **Expired-session cleanup:** two complementary mechanisms — (a) on-demand: when middleware/`getSession` sees an expired token it decodes the payload (jose `decodeJwt`, no verify) to read `sessionId` and marks that row `expired`; (b) a nightly sweep (same pattern as `partition-listener`) that closes **staff** sessions whose `last_active_at` is older than the expiry policy. **Do not sweep customers** — customer sessions have no expiry today (see §4.2).

## 3. Schema (migration)

New file `database/migrations/017_user_session_monitoring.sql` + runner `database/run-migration.ts` style (or extend `scripts/migrations/run_customer_portal_migration.js`). **Add the `.sql` file AND the runner in the same change** — every existing runner points at a SQL file that is missing from this checkout, so copying the pattern verbatim will fail. Executed with the `POSTGRES_*` env vars:

```sql
-- Staff sessions
CREATE TABLE IF NOT EXISTS staff_sessions (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id           uuid NOT NULL REFERENCES staff_members(id) ON DELETE CASCADE,
    staff_email        text NOT NULL,
    role_name          text,
    branch_id          uuid,
    branch_name        text,
    ip_address         text,
    user_agent         text,
    device_name        text,
    location           text,
    login_time         timestamptz NOT NULL DEFAULT now(),
    logout_time        timestamptz,
    duration_seconds   integer,                 -- computed at end: logout_time - login_time
    last_active_at     timestamptz NOT NULL DEFAULT now(),
    session_end_reason text,                    -- 'logout' | 'idle_timeout' | 'expired' | 'revoked'
    pages_viewed       jsonb NOT NULL DEFAULT '[]'::jsonb,  -- [{path,label,viewed_at}]
    created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_staff_sessions_email   ON staff_sessions (staff_email);
CREATE INDEX IF NOT EXISTS idx_staff_sessions_active  ON staff_sessions (logout_time) WHERE logout_time IS NULL;
CREATE INDEX IF NOT EXISTS idx_staff_sessions_login   ON staff_sessions (login_time DESC);

-- Customer sessions: additive columns
ALTER TABLE customer_sessions
    ADD COLUMN IF NOT EXISTS logout_time        timestamptz,
    ADD COLUMN IF NOT EXISTS duration_seconds   integer,
    ADD COLUMN IF NOT EXISTS session_end_reason text,
    ADD COLUMN IF NOT EXISTS user_agent         text;
```

Add a `staff_sessions` entry to `src/lib/schema.ts` for consistency with the drizzle schema (even though these tables are managed by raw SQL migrations, the file documents intent).

## 4. Backend changes

### 4.1 Auth — `src/lib/auth-actions.ts`
- `loginAction`: after password check succeeds →
  1. capture IP / user-agent via `headers()` (same technique `dbLogSecurityEvent` already uses),
  2. `INSERT` into `staff_sessions` (email, role, branch, ip, user_agent, device from UA),
  3. include `sessionId` in the `sessionUser` object passed to `encrypt(...)`,
  4. `dbLogSecurityEvent('Staff Login Success', email, branch, ip, 'info')`.
- On failed login (invalid credentials): `dbLogSecurityEvent('Staff Login Failed', email, ip, 'warning')` — do **not** let the rate limiter path skip logging. (Volume is bounded: `checkRateLimit` already caps attempts per email.)
- `logoutAction`: needs the `sessionId` (decode the cookie payload before clearing — `jose.decodeJwt`, no verify, since the token is still valid at logout), then `UPDATE staff_sessions SET logout_time = now(), duration_seconds = EXTRACT(EPOCH FROM now()-login_time)::int, session_end_reason = 'logout' WHERE id = $sessionId` + `dbLogSecurityEvent('Staff Logout', ...)`.

### 4.2 Session expiry / revocation
- **Facts to build on**: `encrypt()` hardcodes a 2h JWT exp; the payload `expires` (configured duration) is client-side only. `decrypt` throws `JWTExpired` (jose) after 2h, but `decodeJwt` can still read the payload to get `sessionId`.
- `getSession` / a small helper in `src/lib/session.ts`: when `decrypt` throws on an expired token, `decodeJwt` to read `sessionId` and mark that `staff_sessions` row `session_end_reason='expired'` (fire-and-forget, best-effort). Keep returning `null` as today.
- **Nightly sweep — staff only — ✅ IMPLEMENTED (tranche 4)**: `dbSweepExpiredStaffSessions(durationSeconds)` closes active staff sessions whose `last_active_at` is older than the policy; `src/scripts/session-sweep.ts` (run via `npm run session-sweep`, same dotenv-first pattern as the partition workers) reads the configured `session_duration_seconds` and defaults to 7200s (the 2h JWT ceiling). **Scheduling is documented but not auto-enabled (tranche 5):** `scripts/devops/session-sweep.bat` + `session-sweep.sh` wrap the command with logging; Windows Task Scheduler (`schtasks /Create /SC DAILY /ST 03:00 /TN "AAWSA Session Sweep" ...`) and cron (`0 3 * * * .../session-sweep.sh`) recipes live in `docs/WINDOWS_SERVER_DEPLOYMENT.md` (STEP 8b). Do **not** sweep customers — customer sessions have **no expiry today**; imposing one would silently kick customers out.
- `revokeCustomerSessionAction` (`src/lib/actions.ts` ~line 3397): it already logs `Customer Session Revoked`; additionally set `logout_time`, `duration_seconds`, `session_end_reason='revoked'` on the target row.
- New `dbFinalizeStaffSession`/`dbFinalizeCustomerSession` helpers in `src/lib/db-queries.ts`.

### 4.3 Page views + heartbeat — ✅ IMPLEMENTED (tranche 2)
- New route `src/app/api/staff/log-page-view/route.ts` mirroring `/api/customer/log-page-view`: **auth inside the route** — `middleware.ts`/`proxy.ts` short-circuit all `/api/` paths before any session check, so there is no middleware gate. It calls `getSession()` and reads `sessionId` from the JWT payload (client sends nothing extra — just `{path, label}`). Appends `{path, label, viewed_at}` to `pages_viewed` (skips consecutive identical paths) and throttles the `last_active_at` heartbeat to once per 60s.
- Upgraded `/api/customer/log-page-view` to the same timestamped format (`dbLogCustomerPageView(sessionId, pageName, path)`). The old path did two writes per view (`dbIsCustomerSessionValid` bumped `last_active_at`, then `dbLogCustomerPageView` bumped it again); `logCustomerPageViewAction` now does a **single** UPDATE that validates `is_revoked=false`, appends with consecutive-dedupe, and throttles the heartbeat. `dbIsCustomerSessionValid` is retained for `validateCustomerSessionAction`.
- **Wired once in `src/components/layout/app-shell.tsx`** — both admin and staff render the same `<AppShell>`, so one `usePathname()` + `STAFF_PAGE_NAME_MAP` (covers both sidebars' routes) addition covers both. A ref prevents re-POSTing the same path on permission refreshes.
- **Customer layout** (`customer/layout.tsx`) now sends every navigation (`{sessionId, pageName, path, label}`); the per-client-session dedupe ref was removed so repeat visits are kept (server dedupes only consecutive paths).
- **Discovery while implementing:** the live dev DB's `customer_sessions` had **no `pages_viewed` column at all** (the original migration that created the table never added it — `dbLogCustomerPageView` was failing silently in the fire-and-forget path). Migration `018_customer_page_views.sql` adds it as `jsonb NOT NULL DEFAULT '[]'` (converting a legacy `text[]` column in place if one exists in another environment).

### 4.4 Query layer — `src/lib/db-queries.ts` — ✅ IMPLEMENTED (tranche 3)
- `dbGetUserSessions({ page, pageSize, type?, status?, branchName?, branch?, search? })` — UNION CTE of `staff_sessions` + `customer_sessions` with computed `user_type`, derived `status` (active / logout / idle_timeout / expired / revoked / logged_out), `duration_seconds` (live `now()-login_time` while active), sorted by `login_time DESC`, paginated. Customer branch is resolved best-effort via LEFT JOINs on `bulk_meters` / `individual_customers` (customer_sessions has no branch column).
- `dbGetSessionSummary(branchName?)` → `{ active_count, today_count, avg_duration_seconds, total_count }` for the summary cards.
- `dbRevokeStaffSession(sessionId, reason)` (staff kick-out) + existing `dbRevokeCustomerSession`.
- **Staff kick-out is now enforced at two layers (tranche 4):** (1) `middleware.ts` + `proxy.ts` redirect a kicked-out session to `/` and clear the JWT cookie — the Edge runtime can't import `pg`, so they consult the internal `/api/session/revocation-status` endpoint (which short-circuits in middleware and runs on Node) with a 60s in-memory cache; revoked sessions are never cached, so the next request logs them out (≤60s worst case). (2) `getSession()` rejects revoked sessionIds (Node-side, cached via `session-revocation.ts`) so every server action and `/api` route (which skip middleware) is covered too. Both layers fail open if the DB/status endpoint is unreachable.
- **Hardened (tranche 5):** `/api/session/revocation-status` now requires a shared-secret header (`x-internal-key` = `INTERNAL_API_KEY`, the same value `dbValidateApiKey` already checks); middleware/proxy send it on the internal fetch. The endpoint fails **closed** on a missing/wrong key (401) but still fails **open** on DB errors. The kicked-out redirect now carries `?kicked=1`, and the login page (`auth-form.tsx`) shows a one-time "Session Ended by Administrator" banner and strips the flag from the URL.

### 4.5 API + server actions — ✅ IMPLEMENTED (tranche 3)
- Extended `src/app/(dashboard)/admin/security-logs/api/route.ts` with `?view=sessions` (paged, filtered) and `?view=summary`; the default `view=logs` path is untouched. Kick-out goes through a server action (`revokeUserSessionAction(userType, sessionId)`), not a POST route.
- **Permission gate**: the sessions/summary views require `SETTINGS_MANAGE` (the de facto gate — page + sidebar already require it); the legacy logs view keeps its existing `DASHBOARD_VIEW_ALL || SETTINGS_VIEW` gate so nothing breaks. Route-level permission edits still need mirroring in BOTH `middleware.ts` and `proxy.ts` — the new endpoints were intentionally placed inside the already-gated `/admin/security-logs` route, so no middleware change was needed for them.
- **Branch isolation**: non-management staff get `branch_name = session.branchName` applied in the query (`dbGetUserSessions.branchName` / `dbGetSessionSummary`). Customer branch is resolved via the bulk_meters/individual_customers joins, so it works for isolation too (best-effort).
- Server action: `revokeUserSessionAction` (staff + customer dispatch, `SETTINGS_MANAGE || DASHBOARD_VIEW_ALL`, logs `Staff Session Revoked` / `Customer Session Revoked`).
- **Undo (tranche 6):** `reactivateUserSessionAction` reverses an ended session — clears `logout_time` / `duration_seconds` / `session_end_reason` (and `is_revoked` for customers; bumps `last_active_at` for staff so the nightly sweep gives it a fresh lease) — gated the same way and logging `Staff Session Reactivated` / `Customer Session Reactivated`. The User Sessions tab shows a **Reactivate** button on any non-active row in place of Kick Out. It restores the DB row only: a staff user whose cookie was already cleared by the kick-out redirect still signs in again (new session row).

## 5. UI — `src/app/(dashboard)/admin/security-logs/page.tsx`

- **New tab: "User Sessions"** (third tab; keep Security Logs + Customer Sessions as-is for now, or merge Customer Sessions into it later).
- **Summary cards** above the table: Active Now, Logins Today, Avg. Session Duration, Total Sessions.
- **Table columns**: User (email / customer key), Type badge (Staff / Customer), Branch, Login Time, Logout Time (— if active), **Duration** (humanized, e.g. `1h 23m`), Pages Viewed (badges; click → detail dialog with per-page timestamps), IP, Device, Status badge (Active green / Logged out gray / Expired amber / Revoked red), Actions (`Kick Out` for active sessions).
- **Filters**: type, status, branch, text search; pagination via existing `TablePagination`.
- **Detail dialog**: reuse the `Dialog` + `AuditLogDetails` pattern — full page-view history `{path, label, viewed_at}` and raw metadata (user-agent, location).
- **Export CSV**: same `downloadCsv` helper, columns above.
- Type definitions: `UserSession` in `src/types/db.ts`.

## 6. Implementation order (suggested)

1. **Migration**: `.sql` file + runner; run against dev DB; add `staff_sessions` to `schema.ts`.
2. **Auth wiring**: `loginAction`/`logoutAction` row lifecycle + `sessionId` in JWT + login/logout security events.
3. **Expiry/revoke finalization**: `getSession` expired-token marking; customer revoke sets logout fields.
4. **Page-view tracking**: staff route + app-shell wiring; upgrade customer route to timestamps. — ✅ done (migration 018, `/api/staff/log-page-view`, app-shell `STAFF_PAGE_NAME_MAP`, customer route/layout upgrade).
5. **Query layer + API**: `dbGetUserSessions`, summary, kick-out endpoints. — ✅ done.
6. **UI**: User Sessions tab, cards, filters, detail dialog, CSV export. — ✅ done (`user-sessions-tab.tsx` on the Security Logs page). Old **Customer Sessions tab consolidated** into it (tranche 4) — the page now has just Security Logs + User Sessions; the orphaned `getActiveCustomerSessionsAction` was removed.
7. **Tests & verify**: typecheck + unit tests. — ✅ done (tranche 4): `session-monitoring.ts` extracts the pure helpers (status derivation, duration formatting, page-view labels, UNION filter builder) and `src/lib/__tests__/session-monitoring.test.ts` covers them (17 tests; suite total 37).
8. **Operational hardening — ✅ done (tranche 5)**: sweep scheduling wrappers + Task Scheduler/cron docs; shared-secret gate on the internal revocation endpoint (sent by middleware/proxy); kicked-out notice banner (`?kicked=1` → login page); `tests/e2e/kickout.spec.ts` automates login → kick → next navigation lands on login with the notice and cleared cookie (`PLAYWRIGHT_BASE_URL` overrides the server URL; run with the dev server up).

## 7. Edge cases to handle

- **Offline logout** (`app-shell.tsx` explicitly tolerates `logoutAction` failing): session row stays `active` until the staff-only expiry sweep closes it — acceptable; document it. The IndexedDB-cached JWT (`offline-db.ts`) also carries `sessionId`, so offline requests still attribute correctly.
- **JWT expiry vs. configured duration diverge**: the JWT dies at 2h (`encrypt` hardcodes it) even if `session_duration_seconds` is longer. The sweep and the "Expired" status must be based on one explicit policy (recommend: `last_active_at` vs. configured duration, or the 2h ceiling — pick one and document it). Consider flagging this pre-existing divergence to the user.
- **Multiple concurrent sessions per user**: one `staff_sessions` row per login, so this is naturally supported; the JWT carries that row's `sessionId`.
- **Idle-timeout logout** already flows through `logoutAction` → gets `session_end_reason='logout'` (or add `'idle_timeout'` by passing a reason param — recommended).
- **Branch isolation** for non-management viewers: applies cleanly to staff sessions; customer sessions need a branch join or `N/A` (see §4.5).
- **Write amplification**: heartbeat throttling (60s) and page-view dedupe keep the hot paths cheap; consider batching heartbeat into the page-view write.

## 8. Open questions for the user

- Should the existing **Customer Sessions** tab be **replaced** by the unified User Sessions tab, or kept alongside it?
- Add a dedicated **`sessions_view` permission**, or reuse `SETTINGS_MANAGE` (current page gate)?
- Show only staff sessions, or staff **and** customers in the same tab (recommended: both, filterable)?
