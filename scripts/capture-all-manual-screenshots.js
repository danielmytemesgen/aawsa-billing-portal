const { chromium } = require('playwright');
const { SignJWT } = require('jose');
const fs = require('fs');
const path = require('path');

const secretKey = '51587df85f6cc9e4f09242200ec86305760d2837bddfb9036372d80838d6685b';
const key = new TextEncoder().encode(secretKey);

const ROUTES = [
  { id: 'dashboard', url: 'http://localhost:3000/admin/dashboard' },
  { id: 'my-routes', url: 'http://localhost:3000/staff/my-routes' },
  { id: 'meter-readings', url: 'http://localhost:3000/admin/meter-readings' },
  { id: 'reader-monitoring', url: 'http://localhost:3000/admin/routes' },
  { id: 'meter-change', url: 'http://localhost:3000/admin/meter-change' },
  { id: 'branches', url: 'http://localhost:3000/admin/branches' },
  { id: 'staff-management', url: 'http://localhost:3000/admin/staff-management' },
  { id: 'approvals', url: 'http://localhost:3000/admin/approvals' },
  { id: 'roles', url: 'http://localhost:3000/admin/roles-and-permissions' },
  { id: 'notifications', url: 'http://localhost:3000/admin/notifications' },
  { id: 'tariffs', url: 'http://localhost:3000/admin/tariffs' },
  { id: 'route-management', url: 'http://localhost:3000/admin/routes' },
  { id: 'knowledge-base', url: 'http://localhost:3000/admin/knowledge-base' },
  { id: 'bill-management', url: 'http://localhost:3000/admin/bill-management' },
  { id: 'fault-codes', url: 'http://localhost:3000/admin/fault-codes' },
  { id: 'support', url: 'http://localhost:3000/admin/support' },
  { id: 'bulk-meters', url: 'http://localhost:3000/admin/bulk-meters' },
  { id: 'individual-customers', url: 'http://localhost:3000/admin/individual-customers' },
  { id: 'data-entry', url: 'http://localhost:3000/admin/data-entry' },
  { id: 'reports', url: 'http://localhost:3000/admin/reports' },
  { id: 'paid-bills', url: 'http://localhost:3000/admin/reports/paid-bills' },
  { id: 'sent-bills', url: 'http://localhost:3000/admin/reports/sent-bills' },
  { id: 'unsettled-bills', url: 'http://localhost:3000/admin/reports/unsettled-bills' },
  { id: 'settings', url: 'http://localhost:3000/admin/settings' },
  { id: 'promotions', url: 'http://localhost:3000/admin/settings' },
  { id: 'security-logs', url: 'http://localhost:3000/admin/security-logs' },
  { id: 'recycle-bin', url: 'http://localhost:3000/admin/recycle-bin' },
  { id: 'backup', url: 'http://localhost:3000/admin/backup' },
  { id: 'maintenance', url: 'http://localhost:3000/admin/maintenance' },
  { id: 'errors', url: 'http://localhost:3000/admin/support' },
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
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const token = await getAdminToken();
  console.log('Admin token ready.');

  const browser = await chromium.launch({ headless: true });
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

  for (const item of ROUTES) {
    try {
      console.log(`[Capturing ${item.id}] ${item.url}...`);
      await page.goto(item.url, { waitUntil: 'domcontentloaded', timeout: 20000 });
      // Wait for content render
      await page.waitForTimeout(2500);

      const filePath = path.join(outDir, `${item.id}.png`);
      await page.screenshot({ path: filePath, fullPage: false });
      console.log(`✓ Saved ${item.id}.png`);
    } catch (err) {
      console.error(`✗ Error on ${item.id}:`, err.message);
    }
  }

  await browser.close();
  console.log('All actual UI screenshots captured successfully!');
})();
