import { sql } from '@vercel/postgres';

export default async function Script() {
    await sql`
    INSERT INTO permissions (name, description, module) 
    VALUES ('tariffs_create', 'Create new tariff versions', 'Tariff Management')
    ON CONFLICT (name) DO NOTHING;
  `;
}
