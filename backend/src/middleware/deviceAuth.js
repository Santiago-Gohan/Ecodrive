const pool = require('../db');

module.exports = async function deviceAuth(req, res, next) {
  let apiKey = req.headers['x-api-key'];
  const authorization = req.headers.authorization || '';

  if (authorization.startsWith('Bearer ')) {
    apiKey = authorization.slice(7);
  }

  if (!apiKey) {
    return res.status(401).json({ error: 'Token telemático inválido' });
  }

  try {
    const { rows } = await pool.query(
      'SELECT id, placa FROM vehiculos WHERE api_key = $1 AND activo = true',
      [apiKey]
    );

    if (!rows.length) {
      return res.status(401).json({ error: 'Token telemático inválido' });
    }

    req.vehiculo = rows[0];
    next();
  } catch (err) {
    next(err);
  }
};