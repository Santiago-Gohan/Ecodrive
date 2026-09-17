require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const url = new URL(
  process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/ecodrive'
);
const dbName = url.pathname.slice(1);

async function main() {
  const root = new Client({
    host: url.hostname,
    port: url.port,
    user: url.username,
    password: url.password,
    database: 'postgres',
  });
  await root.connect();

  const exists = await root.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
  if (!exists.rowCount) {
    await root.query(`CREATE DATABASE ${dbName}`);
    console.log(`Base de datos '${dbName}' creada`);
  } else {
    console.log(`Base de datos '${dbName}' ya existe`);
  }
  await root.end();

  const db = new Client({
    host: url.hostname,
    port: url.port,
    user: url.username,
    password: url.password,
    database: dbName,
  });
  await db.connect();

  const schema = fs.readFileSync(path.join(__dirname, '../sql/schema.sql'), 'utf8');
  await db.query(schema);
  console.log('Esquema aplicado correctamente');
  await db.end();
}

main().catch((err) => {
  console.error('Error al inicializar la BD:', err.message);
  process.exit(1);
});