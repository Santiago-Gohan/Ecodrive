const pool = require('../db');
const config = require('../config');

// Clave fija del advisory lock para no correr dos purgas a la vez (multi-instancia).
const LLAVE = 879123;
let corriendo = false;
let temporizador = null;

async function ejecutarPurga() {
  if (corriendo) return;
  corriendo = true;
  const client = await pool.connect();
  let lockAdquirido = false;
  try {
    const lock = await client.query('SELECT pg_try_advisory_lock($1) AS ok', [LLAVE]);
    if (!lock.rows[0].ok) return; // otra instancia ya está purgando
    lockAdquirido = true;

    const dias = Math.max(1, config.telemetriaRetencionDias);
    const corte = new Date(Date.now() - dias * 86400000);

    await client.query('BEGIN');
    const agregado = await client.query(
      `INSERT INTO telemetria_resumen
         (vehiculo_id, hora, lecturas, ect_min, ect_max, ect_prom, rpm_max, combustible_prom)
       SELECT
         vehiculo_id,
         date_trunc('hour', fecha_registro) AS hora,
         COUNT(*)::int,
         MIN(ect_temperatura),
         MAX(ect_temperatura),
         AVG(ect_temperatura),
         MAX(rpm)::int,
         AVG(nivel_combustible)
       FROM telemetria_lectura
       WHERE fecha_registro < $1
       GROUP BY vehiculo_id, date_trunc('hour', fecha_registro)
       ON CONFLICT (vehiculo_id, hora) DO NOTHING`,
      [corte]
    );
    const purgado = await client.query(
      'DELETE FROM telemetria_lectura WHERE fecha_registro < $1',
      [corte]
    );
    await client.query('COMMIT');
    await client.query('SELECT pg_advisory_unlock($1)', [LLAVE]);
    lockAdquirido = false;
    console.log(
      `[RETENCION] ${purgado.rowCount} lecturas > ${dias} días movidas a resumen ` +
      `(${agregado.rowCount} horas agregadas).`
    );
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    console.error('[RETENCION] error:', err.message);
  } finally {
    if (lockAdquirido) {
      try { await client.query('SELECT pg_advisory_unlock($1)', [LLAVE]); } catch (_) {}
    }
    client.release();
    corriendo = false;
  }
}

function iniciarRetencion() {
  const minutos = config.purgaIntervaloMin;
  if (!(minutos > 0)) {
    console.log('[RETENCION] desactivada (PURGA_INTERVALO_MIN=0)');
    return;
  }
  ejecutarPurga();
  temporizador = setInterval(ejecutarPurga, minutos * 60000);
  if (temporizador.unref) temporizador.unref();
  console.log(`[RETENCION] purga programada cada ${minutos} min (retención ${config.telemetriaRetencionDias} días).`);
}

module.exports = { iniciarRetencion, ejecutarPurga };