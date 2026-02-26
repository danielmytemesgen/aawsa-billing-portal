Applying MySQL schema for aawsa-billing-portal

This SQL schema was generated to match the Supabase/Postgres types present in the project and to make the project work with XAMPP/MySQL.

How to apply

1. Ensure MySQL (XAMPP) is running.
2. Set environment variables (PowerShell example):

$env:MYSQL_HOST='127.0.0.1'
$env:MYSQL_USER='root'
$env:MYSQL_PASSWORD=''
$env:MYSQL_DATABASE='aawsa_billing'
$env:MYSQL_PORT='3306'

3. Run the runner script from the repository root:

node ./scripts/apply_mysql_schema.js

This will create the database (if missing) and create all tables and stored procedures.

Notes
- The schema maps JSON columns to MySQL JSON types.
- UUID-like string columns are VARCHAR(36) by convention.
- Review and adjust column lengths and indexes as needed for production.
