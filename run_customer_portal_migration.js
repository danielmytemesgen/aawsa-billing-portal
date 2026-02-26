// Migration script to set up customer portal
require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigration() {
    const client = new Client({
        host: process.env.POSTGRES_HOST,
        user: process.env.POSTGRES_USER,
        password: process.env.POSTGRES_PASSWORD,
        database: process.env.POSTGRES_DB,
        port: parseInt(process.env.POSTGRES_PORT || '5432'),
    });

    try {
        console.log('Connecting to database...');
        await client.connect();
        console.log('Connected successfully');

        const sqlPath = path.join(__dirname, 'src', 'database_migrations', '016_customer_portal_setup.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('Running migration 016_customer_portal_setup.sql...');
        await client.query(sql);
        console.log('✅ Migration completed successfully!');
        console.log('Customer portal database setup complete.');
        console.log('- Customer role created');
        console.log('- Customer permissions added');
        console.log('- Authentication fields added to individual_customers table');
        console.log('- RLS policies created');
        console.log('- Helper functions created');

    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        console.error('Full error:', error);
        process.exit(1);
    } finally {
        await client.end();
    }
}

runMigration();
