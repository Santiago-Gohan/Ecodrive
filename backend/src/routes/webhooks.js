const router = require('express').Router();
const crypto = require('crypto');
const pool = require('../db');
const adminAuth = require('../middleware/adminAuth');
const requierePermiso = require('../middleware/permAuth');
const { registrar } = require('../services/audit');
const { entregar } = require('../services/webhooks');

router.use(adminAuth);

/* ---------------- Webhooks ---------------- */

router.get('/', requierePermiso('integraciones:ver'), async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT w.*,
              (SELECT COUNT(*) FROM webhook_entregas e WHERE e.webhook_id = w.id AND e.estado = 'ERROR') AS fallidas,
              (SELECT COUNT(*) FROM webhook_entregas e WHERE e.webhook_id = w.id) AS total
       FROM webhooks w ORDER BY w.created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.post('/', requierePermiso('integraciones:editar'), async (req, res, next) => {
  try {
    const { nombre, url, eventos, secreto, activo } = req.body || {};
    if (!nombre || !url) return res.status(400).json({ error: 'Nombre y URL son obligatorios' });
    const { rows } = await pool.query(
      `INSERT INTO webhooks (nombre, url, eventos, secreto, activo)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [nombre, url, eventos || '', secreto || null, activo !== false]
    );
    registrar({ usuario: req.usuario.sub, ip: req.ip, recurso: 'webhooks', accion: 'crear', detalles: { nombre } });
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', requierePermiso('integraciones:editar'), async (req, res, next) => {
  try {
    const b = req.body || {};
    const cols = ['nombre', 'url', 'eventos', 'secreto', 'activo'];
    const campos = [];
    const params = [req.params.id];
    for (const c of cols) {
      if (c in b) { campos.push(`${c} = $${params.length + 1}`); params.push(b[c]); }
    }
    if (!campos.length) return res.status(400).json({ error: 'No hay campos para actualizar' });
    campos.push('updated_at = now()');
    const { rows } = await pool.query(`UPDATE webhooks SET ${campos.join(', ')} WHERE id = $1 RETURNING *`, params);
    if (!rows.length) return res.status(404).json({ error: 'Webhook no encontrado' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requierePermiso('integraciones:editar'), async (req, res, next) => {
  try {
    const { rows } = await pool.query('DELETE FROM webhooks WHERE id = $1 RETURNING id', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Webhook no encontrado' });
    res.json({ message: 'Webhook eliminado' });
  } catch (err) {
    next(err);
  }
});

router.get('/:id/entregas', requierePermiso('integraciones:ver'), async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, evento, estado, intentos, http_status, error, created_at, enviado_en
       FROM webhook_entregas WHERE webhook_id = $1 ORDER BY created_at DESC LIMIT 100`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/probar', requierePermiso('integraciones:editar'), async (req, res, next) => {
  try {
    const wh = await pool.query('SELECT id FROM webhooks WHERE id = $1', [req.params.id]);
    if (!wh.rows.length) return res.status(404).json({ error: 'Webhook no encontrado' });
    const ins = await pool.query(
      `INSERT INTO webhook_entregas (webhook_id, evento, payload)
       VALUES ($1, 'prueba', $2) RETURNING id`,
      [req.params.id, JSON.stringify({ mensaje: 'Prueba de integración EcoDrive', fecha: new Date().toISOString() })]
    );
    await entregar(ins.rows[0].id);
    const r = await pool.query('SELECT * FROM webhook_entregas WHERE id = $1', [ins.rows[0].id]);
    res.json(r.rows[0]);
  } catch (err) {
    next(err);
  }
});

/* ---------------- Tokens de API (integraciones) ---------------- */

router.get('/tokens', requierePermiso('integraciones:ver'), async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, nombre, activo, ultimo_uso, created_at, substring(token, 1, 12) || \'...\' AS token_preview FROM api_tokens ORDER BY created_at DESC'
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.post('/tokens', requierePermiso('integraciones:editar'), async (req, res, next) => {
  try {
    const { nombre } = req.body || {};
    if (!nombre) return res.status(400).json({ error: 'El nombre es obligatorio' });
    const token = 'ECDV-API-' + crypto.randomBytes(24).toString('hex');
    const { rows } = await pool.query(
      'INSERT INTO api_tokens (nombre, token) VALUES ($1,$2) RETURNING id, nombre, token, created_at',
      [nombre, token]
    );
    registrar({ usuario: req.usuario.sub, ip: req.ip, recurso: 'api_tokens', accion: 'crear', detalles: { nombre } });
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

router.delete('/tokens/:id', requierePermiso('integraciones:editar'), async (req, res, next) => {
  try {
    const { rows } = await pool.query('DELETE FROM api_tokens WHERE id = $1 RETURNING id', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Token no encontrado' });
    res.json({ message: 'Token revocado' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
