const fetch = require('fs').existsSync('node_modules/node-fetch') ? require('node-fetch') : global.fetch;

const BASE_URL = 'http://localhost:3000/api';
const RANDOM = Math.floor(Math.random() * 100000);
const EMAIL = `SIMPLE.TEST.${RANDOM}@EXAMPLE.COM`;
const PASSWORD = 'password123';

async function run() {
    try {
        // 1. Register Uppercase
        let res = await fetch(`${BASE_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                nombre_completo: 'Simple Test',
                username: `simpleuser${RANDOM}`,
                email: EMAIL,
                password: PASSWORD,
                telefono: '123456789'
            })
        });
        let data = await res.json();

        if (!data.success) {
            console.log('VERIFICATION_FAILED_REGISTER');
            return;
        }

        // 2. Login Lowercase
        res = await fetch(`${BASE_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: EMAIL.toLowerCase(),
                password: PASSWORD
            })
        });
        data = await res.json();

        if (data.success) {
            console.log('VERIFICATION_SUCCESS');
        } else {
            console.log('VERIFICATION_FAILED_LOGIN');
        }

    } catch (error) {
        console.log('VERIFICATION_ERROR_' + error.message);
    }
}

run();
