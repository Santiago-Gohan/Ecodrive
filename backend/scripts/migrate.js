/**
 * Runner de migraciones de EcoDrive.
 * Aplica en orden alfabético todos los archivos .sql de sql/migrations que
 * aún no se hayan registrado en la tabla schema_migrations.
 *
 * Uso:  npm run migrate        (usa DATABASE_URL del .env)
 *       npm run migrate -- --dry   (solo lista lo pendiente)
 *
 * Las migraciones del proyecto son idempotentes (IF NOT EXISTS), por lo que
 * volver a ejecutarlas no daña los datos. La tabla schema_migrations evita
 * repetir trabajo innecesario.
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const MIGRATIONS_DIR = path.join(__dirname, '../sql/migrations');
const DRY = process.argv.includes('--dry');

/**
 * Aplica las migraciones pendientes sobre un cliente ya conectado.
 * Reutilizable por el runner CLI y por scripts/db-init.js.
 */
async function aplicarMigraciones(db, { dry = false, silencioso = false } = {}) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      nombre      TEXT PRIMARY KEY,
      aplicado_en TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  const aplicadas = new Set(
    (await db.query('SELECT nombre FROM schema_migrations')).rows.map((r) => r.nombre)
  );

  const archivos = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const pendientes = archivos.filter((f) => !aplicadas.has(f));

  if (!pendientes.length) {
    if (!silencioso) console.log('Sin migraciones pendientes. Todo al día.');
    return;
  }

  if (!silencioso) {
    console.log(`Migraciones pendientes (${pendientes.length}):`);
    pendientes.forEach((f) => console.log('  - ' + f));
  }

  if (dry) {
    if (!silencioso) console.log('\n(--dry) No se aplicó nada.');
    return;
  }

  for (const archivo of pendientes) {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, archivo), 'utf8');
    process.stdout.write(`Aplicando ${archivo} ... `);
    try {
      await db.query('BEGIN');
      await db.query(sql);
      await db.query('INSERT INTO schema_migrations (nombre) VALUES ($1)', [archivo]);
      await db.query('COMMIT');
      console.log('OK');
    } catch (err) {
      await db.query('ROLLBACK');
      console.error('FALLÓ');
      console.error(`  ${err.message}`);
      throw err;
    }
  }

  if (!silencioso) console.log('\nMigraciones aplicadas correctamente.');
}

async function main() {
  const url = new URL(
    process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/ecodrive'
  );
  const ssl = process.env.PGSSL === 'require' ? { rejectUnauthorized: false } : false;

  const db = new Client({
    host: url.hostname,
    port: url.port,
    user: url.username,
    password: url.password,
    database: url.pathname.slice(1),
    ssl,
  });
  await db.connect();
  await aplicarMigraciones(db, { dry: DRY });
  await db.end();
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Error en el runner de migraciones:', err.message);
    process.exit(1);
  });
}

module.exports = { aplicarMigraciones };
