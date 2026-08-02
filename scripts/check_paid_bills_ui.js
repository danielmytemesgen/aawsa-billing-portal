require('dotenv').config({ path: './.env.production' });
const { chromium } = require('playwright');
const { Pool } = require('pg');
const { SignJWT } = require('jose');

async function main() {
  const baseUrl = process.env.NEXTAUTH_URL || `http://${process.env.PUBLIC_SERVER_IP || 'localhost'}:${process.env.PORT || 3000}`;
  const email = process.env.TEST_CSV_USER_EMAIL || 'csvtester@local';

  const pool = new Pool({
    host: process.env.POSTGRES_HOST,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DB,
    port: Number(process.env.POSTGRES_PORT || 5432),
  });

  const client = await pool.connect();
  let staff;
  try {
    const res = await client.query('SELECT * FROM staff_members WHERE LOWER(email) = LOWER($1) LIMIT 1', [email]);
    staff = res.rows[0];
  } finally {
    client.release();
  }
  if (!staff) {
    console.error('Staff not found');
    process.exit(1);
  }

  const key = new TextEncoder().encode(process.env.SESSION_SECRET);
  const token = await new SignJWT({ id: staff.id, email: staff.email, name: staff.name, role: staff.role, branchId: staff.branch_id, permissions: ['reports_generate_all'] }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('2h').sign(key);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const urlObj = new URL(baseUrl);
  await context.addCookies([{ name: 'session', value: token, domain: urlObj.hostname, path: '/', httpOnly: true, secure: urlObj.protocol === 'https:' }]);
  // Pre-populate localStorage user so client components render with permissions
  const userPayload = { id: staff.id, email: staff.email, name: staff.name, role: staff.role, branchId: staff.branch_id, permissions: ['reports_generate_all','reports_generate_branch'] };
  await context.addInitScript(({ key, value }) => { try { localStorage.setItem(key, value); } catch (e) {} }, { key: 'user', value: JSON.stringify(userPayload) });
  const page = await context.newPage();
  page.on('console', (msg) => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', (err) => console.error('PAGE ERROR:', err));
  await page.goto(baseUrl + '/admin/reports/paid-bills', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  const bodyText = await page.textContent('body');
  const found = bodyText && bodyText.includes('Upload Payment CSV');
  console.log('Upload button present in page text?:', !!found);
  // Optionally write snapshot
  const html = await page.content();
  require('fs').writeFileSync('./paid_bills_snapshot.html', html);
  console.log('Wrote paid_bills_snapshot.html');
  await browser.close();
  await pool.end();
}

main().catch(e=>{ console.error(e); process.exit(1); });
