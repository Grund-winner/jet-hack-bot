// ═══════════════════════════════════════════════════════
// EURO54 - Connexion PostgreSQL
// ═══════════════════════════════════════════════════════
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false },
    max: 1
});

async function query(text, params) {
    const client = await pool.connect();
    try {
        const result = await client.query(text, params);
        return result.rows;
    } finally {
        client.release();
    }
}

module.exports = { query, pool };
