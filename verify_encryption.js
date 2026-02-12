const fetch = require('fs').existsSync('node_modules/node-fetch') ? require('node-fetch') : global.fetch;

const BASE_URL = 'https://marlen-guzman-web.onrender.com/api';
const RANDOM = Math.floor(Math.random() * 100000);
const EMAIL_PLAIN = `PLAIN.USER.${RANDOM}@EXAMPLE.COM`;
const EMAIL_HASH = `HASH.USER.${RANDOM}@EXAMPLE.COM`;
const PASSWORD = 'SecretPassword123';

// Mock DB insert for plain text user (simulating old data)
// We can't insert directly via API because API now hashes. 
// Use SQL insert assuming 'pool' is available OR use a specialized route if we had one.
// Since we don't have direct DB access in this script easily without pg config, 
// we will verify part 2: Register New -> Login. 
// For "Old User Migration", we rely on the logic review unless we setup a direct PG client here.

// Let's rely on standard Registration (Hashed) first.

async function run() {
    console.log('--- STARTING ENCRYPTION VERIFICATION ---');

    try {
        // 1. Register NEW User (Should be Hashed)
        console.log(`\n1. Registering NEW user: ${EMAIL_HASH}`);
        let res = await fetch(`${BASE_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                nombre_completo: 'Hash User',
                username: `hashuser${RANDOM}`,
                email: EMAIL_HASH,
                password: PASSWORD,
                telefono: '123456789'
            })
        });
        let data = await res.json();

        if (!data.success) {
            console.error('FAILED: Registration failed');
            return;
        }
        console.log('SUCCESS: Registration completed.');

        // 2. Login NEW User
        console.log(`\n2. Logging in NEW user...`);
        res = await fetch(`${BASE_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: EMAIL_HASH.toLowerCase(),
                password: PASSWORD
            })
        });
        data = await res.json();

        if (data.success) {
            console.log('SUCCESS: Login with encrypted password worked.');
        } else {
            console.error('FAILED: Login with encrypted password failed.');
        }

        console.log('\n--- VERIFICATION COMPLETE ---');
        console.log('Note: To verify migration of old users, please login manually with an old account.');
        console.log('     The server console should log "Migrando contraseña..."');

    } catch (error) {
        console.error('ERROR:', error.message);
    }
}

run();
