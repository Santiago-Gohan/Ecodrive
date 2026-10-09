const pool = require('../db');

/**
 * Autentica un dispositivo de telemetría por API key:
 *  1) API key del vehículo (vehiculos.api_key)  -> req.vehiculo
 *  2) API key de un dispositivo GPS fijo (dispositivos.api_key) -> req.vehiculo + req.dispositivo
 * Acepta la cabecera X-API-Key (prioritaria) o Bearer.
 */
module.exports = async function deviceAuth(req, res, next) {
  let apiKey = req.headers['x-api-key'];

  if (!apiKey) {
    const authorization = req.headers.authorization || '';
    if (authorization.startsWith('Bearer ')) {
      apiKey = authorization.slice(7);
    }
  }

  if (!apiKey) {
    return res.status(401).json({ error: 'Token telemático inválido' });
  }

  try {
    const { rows } = await pool.query(
      'SELECT id, placa FROM vehiculos WHERE api_key = $1 AND activo = true',
      [apiKey]
    );

    if (rows.length) {
      req.vehiculo = rows[0];
      return next();
    }

    // Dispositivo GPS fijo: resuelve el vehículo asociado y actualiza el ping.
    const disp = await pool.query(
      `SELECT d.id, d.vehiculo_id, v.placa
       FROM dispositivos d
       JOIN vehiculos v ON v.id = d.vehiculo_id
       WHERE d.api_key = $1 AND d.activo = true AND v.activo = true`,
      [apiKey]
    );
    if (disp.rows.length) {
      const d = disp.rows[0];
      req.vehiculo = { id: d.vehiculo_id, placa: d.placa };
      req.dispositivo = { id: d.id };
      pool.query('UPDATE dispositivos SET ultimo_ping = now() WHERE id = $1', [d.id]).catch(() => {});
      return next();
    }

    return res.status(401).json({ error: 'Token telemático inválido' });
  } catch (err) {
    next(err);
  }
};
