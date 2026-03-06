
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';

dotenv.config();

async function runMigration() {
    const { query, closePool } = await import('../src/lib/db');

    try {
        console.log('Starting migration statement by statement...');

        // 1. Setup Table
        console.log('Step 1: Setup Table');
        await query(`DROP TABLE IF EXISTS public.promotions CASCADE;`);
        await query(`
            CREATE TABLE public.promotions (
                id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
                title text NOT NULL UNIQUE,
                description text NOT NULL,
                tag text NOT NULL,
                icon_name text DEFAULT 'Megaphone',
                is_active boolean DEFAULT true,
                display_order integer DEFAULT 0,
                created_at timestamp with time zone DEFAULT now() NOT NULL,
                updated_at timestamp with time zone DEFAULT now() NOT NULL
            );
        `);
        console.log('Table created.');

        // 2. Policies
        console.log('Step 2: Policies');
        await query(`ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;`);
        await query(`DROP POLICY IF EXISTS "Allow public read access on promotions" ON public.promotions;`);
        await query(`CREATE POLICY "Allow public read access on promotions" ON public.promotions FOR SELECT TO public USING (true);`);
        await query(`DROP POLICY IF EXISTS "Allow admin manage access on promotions" ON public.promotions;`);
        await query(`CREATE POLICY "Allow admin manage access on promotions" ON public.promotions FOR ALL TO public USING (true);`);

        // 3. Permissions
        console.log('Step 3: Permissions');
        await query(`
            INSERT INTO public.permissions (name, description, category)
            VALUES ('promotions_manage', 'Manage promotional banners on the login page', 'Settings')
            ON CONFLICT (name, category) DO NOTHING;
        `);

        // 4. Assign to Admin
        console.log('Step 4: Assign to Admin');
        await query(`
            DO $$
            DECLARE
                admin_role_id smallint;
                promo_perm_id smallint;
            BEGIN
                SELECT id INTO admin_role_id FROM public.roles WHERE role_name = 'Admin';
                SELECT id INTO promo_perm_id FROM public.permissions WHERE name = 'promotions_manage';

                IF admin_role_id IS NOT NULL AND promo_perm_id IS NOT NULL THEN
                    INSERT INTO public.role_permissions (role_id, permission_id)
                    VALUES (admin_role_id, promo_perm_id)
                    ON CONFLICT (role_id, permission_id) DO NOTHING;
                END IF;
            END $$;
        `);

        // 5. Seeding
        console.log('Step 5: Seeding');
        await query(`
            INSERT INTO public.promotions (title, description, tag, icon_name, display_order)
            VALUES 
            ('Digital Payment Simplified', 'You can now pay your water bills through Telebirr and CBE Birr directly from the portal.', 'Feature Update', 'Megaphone', 1),
            ('Service Maintenance Notice', 'Scheduled maintenance in Kality area this Sunday. Water supply will be restored by 6 PM.', 'Alert', 'Info', 2),
            ('Save Water, Save Life', 'Reporting leaks promptly helps conserve our precious resources. Contact us at 9xx for any issues.', 'Utility', 'Droplets', 3)
            ON CONFLICT (title) DO NOTHING;
        `);

        console.log('Promotions migration executed successfully.');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await closePool();
    }
}

runMigration();
