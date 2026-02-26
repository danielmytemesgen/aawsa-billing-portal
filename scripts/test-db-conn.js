const mysql = require('mysql2/promise');

async function testConn() {
  const host = process.env.MYSQL_HOST || '127.0.0.1';
  const user = process.env.MYSQL_USER || 'root';
  const password = process.env.MYSQL_PASSWORD || '';
  const database = process.env.MYSQL_DATABASE || 'aawsa_billing';
  const port = Number(process.env.MYSQL_PORT || 3306);

  console.log(`Testing DB connection to ${user}@${host}:${port}/${database}`);

  const pool = mysql.createPool({ host, user, password, database, port, connectionLimit: 2, connectTimeout: 5000 });
  try {
    const [rows] = await pool.execute('SELECT 1 as ok');
    console.log('Connection successful, query result:', rows);
    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error('Connection failed:', err && err.code ? `${err.code} - ${err.message}` : err);
    if (err && err.stack) console.error(err.stack);
    try { await pool.end(); } catch (e) {}
    process.exit(1);
  }
}

if (require.main === module) testConn();
module.exports = { testConn };
