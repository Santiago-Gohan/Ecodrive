const router = require('express').Router();
const jwt = require('jsonwebtoken');
const config = require('../config');

const USUARIO_DEMO = {
  username: process.env.ADMIN_USER || 'admin',
  password: process.env.ADMIN_PASS || 'admin123',
  role: 'admin',
};

// Anti fuerza bruta: por IP, X intentos por ventana antes de responder 429.
const intentos = new Map();
const MAX_INTENTOS = config.loginMaxIntentos;
const VENTANA_MS = config.loginVentanaMin * 60 * 1000;

function limpiarVentanas() {
  const ahora = Date.now();
  for (const [ip, d] of intentos) {
    if (ahora > d.resetAt) intentos.delete(ip);
  }
}
setInterval(limpiarVentanas, 60 * 1000).unref();

router.post('/login', (req, res) => {
  const ip = req.ip || req.socket?.remoteAddress || 'desconocida';
  const ahora = Date.now();
  const actual = intentos.get(ip);

  if (actual && ahora < actual.resetAt && actual.count >= MAX_INTENTOS) {
    const retrySe = Math.ceil((actual.resetAt - ahora) / 1000);
    res.set('Retry-After', String(retrySe));
    return res.status(429).json({
      error: `Demasiados intentos fallidos. Intenta en ${retrySe}s.`,
    });
  }

  const { username, password } = req.body || {};

  if (username !== USUARIO_DEMO.username || password !== USUARIO_DEMO.password) {
    if (!actual || ahora >= actual.resetAt) {
      intentos.set(ip, { count: 1, resetAt: ahora + VENTANA_MS });
    } else {
      actual.count += 1;
    }
    return res.status(401).json({ error: 'Credenciales inválidas' });
  }

  intentos.delete(ip);

  const token = jwt.sign(
    { sub: username, role: USUARIO_DEMO.role },
    config.jwtSecret,
    { expiresIn: '8h' }
  );

  res.json({ token, role: USUARIO_DEMO.role });
});

module.exports = router;