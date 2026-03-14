
const mysql = require('mysql2/promise');

async function checkKnowledgeBase() {
  try {
    const connection = await mysql.createConnection({
      host: '127.0.0.1',
      user: 'root',
      password: '',
      database: 'aawsa_billing',
      port: 3306,
    });

    const [rows] = await connection.execute('SELECT * FROM knowledge_base_articles');
    console.log('Knowledge base articles:', rows);
    await connection.end();
  } catch (error) {
    console.error('Error connecting to the database:', error);
  }
}

checkKnowledgeBase();
