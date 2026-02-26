const { Pool } = require('pg');
const { randomUUID } = require('crypto');
const pool = new Pool({
    host: 'localhost',
    user: 'postgres',
    password: 'Da@121212',
    database: 'aawsa_billing',
    port: 5432
});

async function testSoftDelete() {
    try {
        console.log('--- Starting Soft-Delete Verification Test ---');

        // 1. Create a dummy fault code
        const id = randomUUID();
        await pool.query(`
      INSERT INTO fault_codes (id, code, description, category, created_at)
      VALUES ($1, $2, 'Test Description', 'Test Category', now())
    `, [id, 'TEST001']);
        console.log(`Step 1: Created test fault code with UUID: ${id}`);

        // 2. Mock deleting the fault code (using the query logic directly)
        await pool.query('BEGIN');
        const dataRes = await pool.query('SELECT * FROM fault_codes WHERE id = $1', [id]);
        const originalData = dataRes.rows[0];

        await pool.query('UPDATE fault_codes SET deleted_at = now(), deleted_by = NULL WHERE id = $1', [id]);
        await pool.query('INSERT INTO recycle_bin (entity_type, entity_id, entity_name, original_data) VALUES ($1, $2, $3, $4)',
            ['fault_code', id, 'TEST001', JSON.stringify(originalData)]
        );
        await pool.query('COMMIT');
        console.log('Step 2: Soft-deleted the fault code and moved to recycle bin.');

        // 3. Verify it's in recycle bin
        const rbRes = await pool.query('SELECT * FROM recycle_bin WHERE entity_id = $1 AND entity_type = $2', [id, 'fault_code']);
        if (rbRes.rows.length > 0) {
            console.log('Step 3: Verification SUCCESS - Item found in recycle_bin.');
        } else {
            throw new Error('Verification FAILED - Item NOT found in recycle_bin.');
        }

        // 4. Verify it's NOT visible in normal fetch
        const fetchRes = await pool.query('SELECT * FROM fault_codes WHERE id = $1 AND deleted_at IS NULL', [id]);
        if (fetchRes.rows.length === 0) {
            console.log('Step 4: Verification SUCCESS - Item is filtered out from active fault codes.');
        } else {
            throw new Error('Verification FAILED - Item is still visible in active fault codes.');
        }

        // 5. Restore it
        await pool.query('BEGIN');
        await pool.query('UPDATE fault_codes SET deleted_at = NULL, deleted_by = NULL WHERE id = $1', [id]);
        await pool.query('DELETE FROM recycle_bin WHERE entity_id = $1 AND entity_type = $2', [id, 'fault_code']);
        await pool.query('COMMIT');
        console.log('Step 5: Restored the fault code.');

        // 6. Verify it's back
        const restoreRes = await pool.query('SELECT * FROM fault_codes WHERE id = $1 AND deleted_at IS NULL', [id]);
        if (restoreRes.rows.length > 0) {
            console.log('Step 6: Verification SUCCESS - Item is back in active fault codes.');
        } else {
            throw new Error('Verification FAILED - Item did not reappear after restore.');
        }

        // 7. Cleanup
        await pool.query('DELETE FROM fault_codes WHERE id = $1', [id]);
        console.log('Step 7: Cleanup complete.');

        console.log('\n✅ ALL VERIFICATION STEPS PASSED');
    } catch (err) {
        console.error('\n❌ VERIFICATION FAILED:', err.message);
        if (pool) await pool.query('ROLLBACK').catch(() => { });
    } finally {
        pool.end();
    }
}

testSoftDelete();
