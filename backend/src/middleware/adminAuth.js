const jwt = require('jsonwebtoken');
const config = require('../config');

module.exports = function adminAuth(req, res, next) {
  const authorization = req.headers.authorization || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret);
    // req.usuario = { sub, role, uid, sede, ... } — el control fino de
    // permisos por rol/sede lo aplica el middleware permAuth por ruta.
    req.usuario = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Sesión inválida o expirada' });
  }
};