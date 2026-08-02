#!/usr/bin/env node
const urlArg = process.argv[2] || process.env.DEPLOY_URL;
if (!urlArg) {
  console.error('Usage: node scripts/check-sw.js <site-url>  (e.g. https://example.com)');
  process.exit(2);
}
const fetch = global.fetch || (await import('node-fetch')).default;
(async () => {
  try {
    const base = urlArg.replace(/\/$/, '');
    const candidates = [base + '/sw.js', base + '/staff/sw.js'];
    let ok = false;
    for (const candidate of candidates) {
      try {
        const res = await fetch(candidate, { method: 'GET', cache: 'no-store' });
        const ct = res.headers.get('content-type') || '';
        console.log(`Checked ${candidate} -> ${res.status} ${ct}`);
        if (res.ok && !ct.includes('text/html')) {
          console.log('OK: valid service worker found at', candidate);
          ok = true;
          break;
        }
      } catch (e) {
        console.warn('Fetch failed for', candidate, e.message || e);
      }
    }
    if (!ok) {
      console.error('No valid sw.js found at candidates. Ensure sw.js is deployed to site root and served as JavaScript.');
      process.exit(1);
    }
    process.exit(0);
  } catch (err) {
    console.error('Error checking sw.js:', err);
    process.exit(3);
  }
})();
