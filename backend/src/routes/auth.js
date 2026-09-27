const router = require('express').Router();
const jwt = require('jsonwebtoken');
const config = require('../config');

const USUARIO_DEMO = {
  username: process.env.ADMIN_USER || 'admin',
  password: process.env.ADMIN_PASS || 'admin123',
  role: 'admin',
};

router.post('/login', (req, res) => {
  const { username, password } = req.body || {};

  if (username !== USUARIO_DEMO.username || password !== USUARIO_DEMO.password) {
    return res.status(401).json({ error: 'Credenciales inválidas' });
  }

  const token = jwt.sign(
    { sub: username, role: USUARIO_DEMO.role },
    config.jwtSecret,
    { expiresIn: '8h' }
  );

  res.json({ token, role: USUARIO_DEMO.role });
});

module.exports = router;