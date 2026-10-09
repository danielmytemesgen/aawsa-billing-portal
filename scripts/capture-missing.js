const { chromium } = require('playwright');
const { SignJWT } = require('jose');
const fs = require('fs');
const path = require('path');

const secretKey = '51587df85f6cc9e4f09242200ec86305760d2837bddfb9036372d80838d6685b';
const key = new TextEncoder().encode(secretKey);

const MISSING = [
  { id: 'bill-management', url: 'http://localhost:3000/admin/bill-management' },
  { id: 'individual-customers', url: 'http://localhost:3000/admin/individual-customers' },
  { id: 'data-entry', url: 'http://localhost:3000/admin/data-entry' },
  { id: 'reports', url: 'http://localhost:3000/admin/reports' },
  { id: 'paid-bills', url: 'http://localhost:3000/admin/reports/paid-bills' },
  { id: 'sent-bills', url: 'http://localhost:3000/admin/reports/sent-bills' },
  { id: 'unsettled-bills', url: 'http://localhost:3000/admin/reports/unsettled-bills' },
  { id: 'settings', url: 'http://localhost:3000/admin/settings' },
  { id: 'security-logs', url: 'http://localhost:3000/admin/security-logs' },
  { id: 'recycle-bin', url: 'http://localhost:3000/admin/recycle-bin' },
];

async function getAdminToken() {
  const payload = {
    id: '6ee3b9cb-4636-418d-aea6-e9cb8d932e05',
    email: 'admin@aawsa.com',
    name: 'System Administrator',
    role: 'Admin',
    permissions: ['*'],
  };
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(key);
}

(async () => {
  const outDir = path.join(process.cwd(), 'public', 'images', 'manual');
  const token = await getAdminToken();

  for (const item of MISSING) {
    let browser;
    try {
      console.log(`Starting capture for ${item.id}...`);
      browser = await chromium.launch({ headless: true });
      const context = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 1.25,
      });

      await context.addCookies([
        {
          name: 'session',
          value: token,
          domain: 'localhost',
          path: '/',
        },
      ]);

      await context.addInitScript(() => {
        localStorage.setItem(
          'user',
          JSON.stringify({
            id: '6ee3b9cb-4636-418d-aea6-e9cb8d932e05',
            email: 'admin@aawsa.com',
            name: 'System Administrator',
            role: 'Admin',
            permissions: ['*'],
            branchName: 'Head Office',
            branchId: '00000000-0000-0000-0000-000000000000',
          })
        );
      });

      const page = await context.newPage();
      await page.goto(item.url, { waitUntil: 'domcontentloaded', timeout: 50000 });
      await page.waitForTimeout(4000);

      const filePath = path.join(outDir, `${item.id}.png`);
      await page.screenshot({ path: filePath, fullPage: false });
      console.log(`✓ Successfully saved ${item.id}.png`);
    } catch (err) {
      console.error(`✗ Failed ${item.id}:`, err.message);
    } finally {
      if (browser) await browser.close();
    }
  }

  console.log('Finished capturing missing screenshots!');
})();
