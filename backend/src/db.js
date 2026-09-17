const { Pool } = require('pg');
const config = require('./config');

const pool = new Pool({ connectionString: config.databaseUrl });

pool.on('error', (err) => {
  console.error('Error inesperado en el pool de PostgreSQL:', err.message);
});

async function initDb() {
  const client = await pool.connect();
  try {
    await client.query('SELECT 1');
    console.log('Conexión a PostgreSQL establecida');
  } finally {
    client.release();
  }
}

module.exports = pool;
module.exports.initDb = initDb;