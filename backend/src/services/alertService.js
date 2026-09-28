const pool = require('../db');
const config = require('../config');

async function registraLectura({ vehiculo, ect, rpm, nivelCombustible, timestamp }) {
  const lectura = await pool.query(
    `INSERT INTO telemetria_lectura (vehiculo_id, ect_temperatura, rpm, nivel_combustible, fecha_registro)
     VALUES ($1, $2, $3, $4, COALESCE($5, now()))
     RETURNING *`,
    [vehiculo.id, ect, rpm, (Number(nivelCombustible) >= 0 && Number(nivelCombustible) <= 100) ? Number(nivelCombustible) : null, timestamp || null]
  );

  const excede = Number(ect) > config.umbralEct;
  if (!excede) {
    return { lectura: lectura.rows[0], alerta: null, excede };
  }

  const yaAlertado = await pool.query(
    `SELECT id FROM alerta_mantenimiento
     WHERE vehiculo_id = $1 AND estado IN ('PENDIENTE', 'ACTIVA')`,
    [vehiculo.id]
  );

  if (yaAlertado.rows.length) {
    return { lectura: lectura.rows[0], alerta: null, excede, yaAlertado: true };
  }

  const alerta = await pool.query(
    `INSERT INTO alerta_mantenimiento (vehiculo_id, tipo_alerta, severidad, estado)
     VALUES ($1, 'SOBRECALENTAMIENTO', $2, 'ACTIVA')
     RETURNING *`,
    [vehiculo.id, config.severidadAlerta]
  );

  return { lectura: lectura.rows[0], alerta: alerta.rows[0], excede };
}

module.exports = { registraLectura };