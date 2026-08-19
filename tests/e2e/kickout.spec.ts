import { test, expect } from '@playwright/test';
import { Pool } from 'pg';
import { randomUUID } from 'crypto';
import dotenv from 'dotenv';

// End-to-end test for staff kick-out enforcement (session monitoring).
//
// Scenario: a staff member logs in, an admin "kicks out" their session
// (finalizes the staff_sessions row, exactly what revokeUserSessionAction
// does), and the NEXT navigation must be redirected to the login page with
// the kicked-out notice (?kicked=1) and the JWT cookie cleared.
//
// Prerequisites:
//   - A running app server: PLAYWRIGHT_BASE_URL (default http://localhost:3000)
//   - A reachable DB with the same env as the app (.env.local), and the
//     staff_sessions table (migration 017) applied.
//
// Note on timing: the middleware caches "active" answers for 60s, so a kick-out
// takes effect within up to 60s. The test waits that out on purpose to assert
// the real end-to-end behavior.

const EMAIL = `kickout-e2e-${Date.now()}@aawsa.com`;
const PASSWORD = 'Kick0ut!Test2026';

let pool: Pool;

test.beforeAll(async () => {
  dotenv.config({ path: '.env.local' });
  pool = new Pool({
    host: process.env.POSTGRES_HOST,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DB,
    port: Number(process.env.POSTGRES_PORT || 5432),
  });

  // Throwaway staff account with the Admin role (role_id 1) so the dashboard
  // and Security Logs are reachable. Passwords are stored plaintext in this
  // app (dev convention — see getStaffMemberForAuth).
  const id = randomUUID();
  const now = new Date();
  await pool.query(
    `INSERT INTO staff_members (id, name, email, password, role_id, role, created_at, updated_at)
     VALUES ($1, $2, $3, $4, 1, 'Admin', $5, $5)`,
    [id, 'Kickout E2E Test', EMAIL, PASSWORD, now]
  );
});

test.afterAll(async () => {
  try {
    if (pool) {
      // Clean up: staff cascade-deletes its sessions; events cleaned separately.
      await pool.query('DELETE FROM staff_members WHERE email = $1', [EMAIL]);
      await pool.query('DELETE FROM security_logs WHERE staff_email = $1', [EMAIL]);
      await pool.end();
    }
  } catch (e) {
    console.warn('Kickout e2e cleanup failed:', e);
  }
});

test('kicked-out staff session is redirected to login with notice and cleared cookie', async ({ page, context }) => {
  test.setTimeout(180_000);

  // 1. Log in
  await page.goto('/');
  await page.getByPlaceholder('admin@aawsa.com').fill(EMAIL);
  await page.getByPlaceholder('•••••').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign In' }).click();

  // The Admin role routes to /admin/dashboard.
  await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 30_000 });

  // 2. Grab the fresh staff session row and finalize it (what "Kick Out" does:
  //    same columns as dbRevokeStaffSession).
  const { rows } = await pool.query(
    `SELECT id FROM staff_sessions
     WHERE staff_email = $1 AND logout_time IS NULL
     ORDER BY created_at DESC LIMIT 1`,
    [EMAIL]
  );
  expect(rows.length).toBe(1);
  const sessionId = rows[0].id as string;

  await pool.query(
    `UPDATE staff_sessions
     SET logout_time = now(),
         duration_seconds = EXTRACT(EPOCH FROM (now() - login_time))::int,
         session_end_reason = 'revoked'
     WHERE id = $1 AND logout_time IS NULL`,
    [sessionId]
  );

  // 3. The middleware caches "active" answers for 60s — wait it out so the
  //    next check actually sees the revoked row.
  await page.waitForTimeout(65_000);

  // 4. Navigate to a protected admin page: must be redirected to the login
  //    page with the kicked notice, and the session cookie must be cleared.
  //    The redirect carries ?kicked=1; the login page shows the banner once
  //    and then strips the flag from the URL, so assert on the banner.
  await page.goto('/admin/security-logs');
  await expect(page.getByText('Session Ended by Administrator')).toBeVisible({ timeout: 15_000 });
  await expect(page).toHaveURL(/\/$/, { timeout: 15_000 });

  const cookies = await context.cookies();
  expect(cookies.find(c => c.name === 'session')).toBeUndefined();

  // 5. The block persists: no cookie means every protected route bounces home.
  await page.goto('/admin/dashboard');
  await expect(page).toHaveURL(/\/$/, { timeout: 15_000 });
});
