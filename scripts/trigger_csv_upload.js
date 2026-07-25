require('dotenv').config({ path: './.env.production' });
const { chromium } = require('playwright');
const fs = require('fs');
const { Pool } = require('pg');
const { SignJWT } = require('jose');

const pool = new Pool({
  host: process.env.POSTGRES_HOST,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB,
  port: Number(process.env.POSTGRES_PORT || 5432),
});

async function main() {
  const baseUrl = process.env.NEXTAUTH_URL || `http://${process.env.PUBLIC_SERVER_IP || 'localhost'}:${process.env.PORT || 3000}`;
  const email = process.env.TEST_CSV_USER_EMAIL || 'csvtester@local';
  const password = process.env.TEST_CSV_USER_PASSWORD || 'Test1234';

  const csvPath = './test_payment_upload.csv';
  if (!fs.existsSync(csvPath)) {
    console.error('CSV file not found:', csvPath);
    process.exit(1);
  }

  // Create a session JWT for the test user so the page is authenticated
  const client = await pool.connect();
  let staff = null;
  try {
    const res = await client.query('SELECT * FROM staff_members WHERE LOWER(email) = LOWER($1) LIMIT 1', [email]);
    staff = res.rows[0];
  } finally {
    client.release();
  }

  if (!staff) {
    console.error('Test staff not found in DB:', email);
    await pool.end();
    process.exit(1);
  }

  const key = new TextEncoder().encode(process.env.SESSION_SECRET);
  const token = await new SignJWT({
    id: staff.id,
    email: staff.email,
    name: staff.name,
    role: staff.role,
    branchId: staff.branch_id,
    permissions: ['reports_generate_all','reports_generate_branch'],
  }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('2h').sign(key);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  // Set the session cookie for the target host so server treats requests as authenticated
  const urlObj = new URL(baseUrl);
  await context.addCookies([{ name: 'session', value: token, domain: urlObj.hostname, path: '/', httpOnly: true, secure: urlObj.protocol === 'https:' }]);

  // Also pre-populate localStorage 'user' so client components render with permissions
  const userPayload = {
    id: staff.id,
    email: staff.email,
    name: staff.name,
    role: staff.role,
    branchId: staff.branch_id,
    permissions: ['reports_generate_all','reports_generate_branch']
  };
  await context.addInitScript(({ key, value }) => {
    try { localStorage.setItem(key, value); } catch (e) { }
  }, { key: 'user', value: JSON.stringify(userPayload) });

  const page = await context.newPage();

  console.log('Navigating to', baseUrl);
  await page.goto(baseUrl, { waitUntil: 'networkidle' });

  // Login
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await Promise.all([page.click('button:has-text("Sign In")'), page.waitForNavigation({ waitUntil: 'networkidle', timeout: 15000 }).catch(() => {})]);
  console.log('Login attempted');

  // Go to Paid Bills report
  const target = baseUrl.replace(/\/$/, '') + '/admin/reports/paid-bills';
  await page.goto(target, { waitUntil: 'networkidle' });
  console.log('Opened paid bills page');

  // Click Upload Payment CSV button
  await page.click('button:has-text("Upload Payment CSV")');
  await page.waitForSelector('input[type="file"]', { state: 'visible', timeout: 5000 });
  const input = await page.$('input[type="file"]');
  await input.setInputFiles(csvPath);
  console.log('CSV file attached');

  // Click Apply Payment Updates button
  await page.click('button:has-text("Apply Payment Updates")');
  console.log('Clicked Apply Payment Updates');

  // Wait for possible toast or upload completion
  await page.waitForTimeout(5000);

  await browser.close();
  console.log('Browser closed');
}

main().catch((e) => { console.error('Playwright error:', e); process.exit(1); });
