const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

async function run() {
    try {
        console.log('Adding missing columns...');
        await pool.query("ALTER TABLE propiedades ADD COLUMN IF NOT EXISTS estacionamientos INT DEFAULT 0");
        await pool.query("ALTER TABLE propiedades ADD COLUMN IF NOT EXISTS piscina BOOLEAN DEFAULT FALSE");
        await pool.query("ALTER TABLE propiedades ADD COLUMN IF NOT EXISTS ascensor BOOLEAN DEFAULT FALSE");
        await pool.query("ALTER TABLE propiedades ADD COLUMN IF NOT EXISTS quincho BOOLEAN DEFAULT FALSE"); // Adding just in case
        console.log('✅ Columns added successfully.');
    } catch (err) {
        console.error('❌ Error updating schema:', err);
    } finally {
        pool.end();
    }
}

run();
