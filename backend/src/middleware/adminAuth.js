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
    if (payload.role !== 'admin') {
      return res.status(403).json({ error: 'Se requieren permisos de administrador' });
    }
    req.usuario = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Sesión inválida o expirada' });
  }
};