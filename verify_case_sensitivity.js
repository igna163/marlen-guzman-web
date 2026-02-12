// Native fetch is used in Node 18+

const BASE_URL = 'http://localhost:3000/api';
const EMAIL_BASE = 'test.case' + Math.floor(Math.random() * 10000) + '@example.com';
const PASSWORD = 'password123';

async function test() {
    console.log(`--- Starting Case Sensitivity Test ---`);
    console.log(`Target Email (Canonical): ${EMAIL_BASE}`);

    // 1. Register with UPPERCASE
    const emailUpper = EMAIL_BASE.toUpperCase();
    console.log(`\n1. Registering with UPPERCASE email: ${emailUpper}`);
    let res = await fetch(`${BASE_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            nombre_completo: 'Test User',
            username: 'testuser' + Math.floor(Math.random() * 10000),
            email: emailUpper,
            password: PASSWORD,
            telefono: '123456789'
        })
    });
    let data = await res.json();
    console.log('Register Response:', data);

    if (!data.success) {
        console.error('Registration failed. Aborting.');
        return;
    }

    // 2. Login with Lowercase
    console.log(`\n2. Logging in with lowercase email: ${EMAIL_BASE}`);
    res = await fetch(`${BASE_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: EMAIL_BASE,
            password: PASSWORD
        })
    });
    data = await res.json();
    console.log('Login (Lower) Success:', data.success);

    // 3. Login with Mixed Case
    const emailMixed = EMAIL_BASE.charAt(0).toUpperCase() + EMAIL_BASE.slice(1);
    console.log(`\n3. Logging in with Mixed Case email: ${emailMixed}`);
    res = await fetch(`${BASE_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: emailMixed,
            password: PASSWORD
        })
    });
    data = await res.json();
    console.log('Login (Mixed) Success:', data.success);

    // 4. Verify DB storage (via Login response user object)
    if (data.user && data.user.email === EMAIL_BASE) {
        console.log(`\n4. Verified: Email is stored as lowercase in DB (${data.user.email})`);
    } else {
        console.log(`\n4. Warning: Email might not be stored as lowercase. Got: ${data.user ? data.user.email : 'No User'}`);
    }

    // 5. Duplicate Check
    console.log(`\n5. Trying to register duplicate with UPPERCASE: ${emailUpper}`);
    res = await fetch(`${BASE_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            nombre_completo: 'Test User 2',
            username: 'testuser' + Math.floor(Math.random() * 10000),
            email: emailUpper,
            password: PASSWORD,
            telefono: '123456789'
        })
    });
    data = await res.json();
    console.log('Duplicate Register Response (Should fail):', data.success === false);
}

test();
