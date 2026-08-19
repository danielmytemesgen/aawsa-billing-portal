import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load .env.local BEFORE importing db.ts — env.ts parses process.env at module
// load time, and top-level imports are hoisted, so a static import would read
// empty defaults (and fail with "client password must be a string").
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

async function run() {
  try {
    if (!fs.existsSync(MIGRATIONS_DIR)) {
      console.error(
        `Migrations directory not found: ${MIGRATIONS_DIR}\n` +
        'Note: *.sql files are gitignored in this repo. Copy the .sql files from the main ' +
        'checkout (see .freebuff/run.md -> Database setup) before running the migration.'
      );
      process.exit(1);
    }

    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort(); // filename order: 017_..., 018_...

    if (files.length === 0) {
      console.error(
        `No .sql migration files found in ${MIGRATIONS_DIR}\n` +
        'Note: *.sql files are gitignored in this repo. Copy the .sql files from the main ' +
        'checkout (see .freebuff/run.md -> Database setup) before running the migration.'
      );
      process.exit(1);
    }

    const { query } = await import('../src/lib/db');

    for (const file of files) {
      const fullPath = path.join(MIGRATIONS_DIR, file);
      const sql = fs.readFileSync(fullPath, 'utf8');
      await query(sql);
      console.log(`Applied ${file}`);
    }
    console.log(`Migration OK (${files.length} file(s))`);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
