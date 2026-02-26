// Simple test to create a bulk meter reading via the actions/db layer
// Usage: node ./scripts/test-create-bulk-reading.js

const path = require('path');
// Ensure NODE_ENV / env vars match your local .env or system env
process.env.MYSQL_HOST = process.env.MYSQL_HOST || '127.0.0.1';
process.env.MYSQL_USER = process.env.MYSQL_USER || 'root';
process.env.MYSQL_PASSWORD = process.env.MYSQL_PASSWORD || '';
process.env.MYSQL_DATABASE = process.env.MYSQL_DATABASE || 'aawsa_billing';

(async () => {
  try {
    const { createBulkMeterReadingAction } = require(path.join(__dirname, '..', 'src', 'lib', 'actions'));

    // Replace these with a real bulk meter customerKeyNumber that exists in your DB
    const sample = {
      bulkMeterId: 'SAMPLE_BULK_CUSTOMER_KEY',
      readingValue: 123.456,
      monthYear: '2025-10',
      readingDate: new Date().toISOString(),
      isEstimate: 0,
      notes: 'Test reading from script'
    };

    console.log('Attempting to create bulk meter reading for', sample.bulkMeterId);
    const result = await createBulkMeterReadingAction(sample);
    console.log('Result:', result);
  } catch (err) {
    console.error('Test failed:', err);
    process.exit(1);
  }
})();
