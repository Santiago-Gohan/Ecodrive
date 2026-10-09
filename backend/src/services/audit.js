const pool = require('../db');

/**
 * Registra una acción en audit_log. Nunca lanza: la auditoría no debe
 * tumbar la operación principal.
 */
async function registrar({ usuario, ip, recurso, accion, detalles }) {
  try {
    await pool.query(
      `INSERT INTO audit_log (usuario, ip, recurso, accion, detalles)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        usuario ? String(usuario).slice(0, 60) : null,
        ip ? String(ip).slice(0, 60) : null,
        recurso ? String(recurso).slice(0, 120) : null,
        accion ? String(accion).slice(0, 60) : null,
        detalles ? JSON.stringify(detalles).slice(0, 4000) : null,
      ]
    );
  } catch (err) {
    console.error('No se pudo registrar auditoría:', err.message);
  }
}

module.exports = { registrar };
