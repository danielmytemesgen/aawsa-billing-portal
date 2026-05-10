import { query } from '../src/lib/db';

async function main() {
    try {
        const users = await query('SELECT email, password FROM staff_members');
        console.log('Users:', JSON.stringify(users, null, 2));
    } catch (err) {
        console.error(err);
    }
}

main();
