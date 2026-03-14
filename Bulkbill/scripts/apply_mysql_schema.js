// apply_mysql_schema.js
// Run with: node ./scripts/apply_mysql_schema.js
// Requires: MYSQL_HOST, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE, MYSQL_PORT (optional, default 3306)

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

async function main() {
  const host = process.env.MYSQL_HOST || '127.0.0.1';
  const user = process.env.MYSQL_USER || 'root';
  const password = process.env.MYSQL_PASSWORD || '';
  const database = process.env.MYSQL_DATABASE || 'aawsa_billing';
  const port = parseInt(process.env.MYSQL_PORT || '3306', 10);

  const sqlPath = path.resolve(__dirname, '..', 'sql', 'mysql_schema.sql');
  if (!fs.existsSync(sqlPath)) {
    console.error('Schema file not found at', sqlPath);
    process.exit(1);
  }

  const sql = fs.readFileSync(sqlPath, 'utf8');

  let connection;
  try {
    connection = await mysql.createConnection({ host, user, password, port, multipleStatements: true });
    // Ensure database exists
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await connection.query(`USE \`${database}\``);
    console.log('Applying schema...');
    await connection.query(sql);
    console.log('Schema applied successfully.');
  } catch (err) {
    console.error('Failed to apply schema:', err);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

main();
