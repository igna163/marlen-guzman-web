
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

async function check() {
    try {
        console.log("Checking columns for 'propiedades2'...");
        const resCol = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'propiedades2'");
        console.log(resCol.rows.map(r => `${r.column_name} (${r.data_type})`).join('\n'));

        console.log("\nChecking one row...");
        const resRow = await pool.query("SELECT * FROM propiedades2 LIMIT 1");
        console.log(JSON.stringify(resRow.rows[0], null, 2));

    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}

check();
