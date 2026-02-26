// scripts/apply_migrations.js
// Run with: node ./scripts/apply_migrations.js
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

  const migrationsPath = path.resolve(__dirname, '..', 'database_migrations');
  if (!fs.existsSync(migrationsPath)) {
    console.error('Migrations directory not found at', migrationsPath);
    process.exit(1);
  }

  const migrationFiles = fs.readdirSync(migrationsPath)
    .filter(file => file.endsWith('.sql'))
    .sort();

  if (migrationFiles.length === 0) {
    console.log('No migration files found.');
    return;
  }

  let connection;
  try {
    connection = await mysql.createConnection({ host, user, password, database, port, multipleStatements: true });
    console.log('Connected to database.');

    for (const file of migrationFiles) {
      const filePath = path.join(migrationsPath, file);
      const sql = fs.readFileSync(filePath, 'utf8');
      console.log(`Applying migration: ${file}`);
      await connection.query(sql);
      console.log(`Migration ${file} applied successfully.`);
    }

  } catch (err) {
    console.error('Failed to apply migrations:', err);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('Database connection closed.');
    }
  }
}

main();
