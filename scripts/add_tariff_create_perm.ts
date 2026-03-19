import { query } from '../src/lib/db';

export default async function Script() {
    await query(`
    INSERT INTO permissions (name, description, category) 
    VALUES ('tariffs_create', 'Create new tariff versions', 'Tariff Management')
    ON CONFLICT (name) DO NOTHING;
  `);
}
