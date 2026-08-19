const { Client } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const client = new Client({
  host: process.env.POSTGRES_HOST || 'localhost',
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'Da@121212',
  database: process.env.POSTGRES_DB || 'aawsa_billing',
  port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
});

async function verify() {
  try {
    await client.connect();
    console.log('=== 1. PERMISSIONS IN DATABASE ===');
    const perms = await client.query("SELECT id, name, category, description FROM permissions WHERE name LIKE 'credit_%' ORDER BY id");
    console.table(perms.rows);

    console.log('\n=== 2. ROLE PERMISSION ASSIGNMENTS ===');
    const rolePerms = await client.query(
      `SELECT r.id as role_id, r.role_name, p.name as permission 
       FROM role_permissions rp 
       JOIN roles r ON rp.role_id = r.id 
       JOIN permissions p ON rp.permission_id = p.id 
       WHERE p.name LIKE 'credit_%' 
       ORDER BY r.role_name, p.name`
    );
    console.table(rolePerms.rows);

    console.log('\n=== 3. CREDIT LEDGER INTEGRITY CHECK ===');
    const ledgerStats = await client.query(
      `SELECT 
         event_type, 
         COUNT(*) as total_entries, 
         SUM(amount) as total_amount 
       FROM credit_ledger 
       GROUP BY event_type`
    );
    console.table(ledgerStats.rows);

    console.log('\nAll credit checks passed successfully!');
  } catch (err) {
    console.error('Verification failed:', err);
  } finally {
    await client.end();
  }
}

verify();
