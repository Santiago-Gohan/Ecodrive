const router = require('express').Router();
const crypto = require('crypto');
const pool = require('../db');
const adminAuth = require('../middleware/adminAuth');

router.use(adminAuth);

router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT
         v.id, v.placa, v.nombre, v.activo, v.fecha_creacion,
         (SELECT COUNT(*) FROM telemetria_lectura t WHERE t.vehiculo_id = v.id) AS total_lecturas,
         (SELECT COUNT(*) FROM alerta_mantenimiento a
          WHERE a.vehiculo_id = v.id AND a.estado IN ('PENDIENTE', 'ACTIVA')) AS alertas_activas
       FROM vehiculos v ORDER BY v.placa`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { placa, nombre } = req.body || {};
    if (!placa || !String(placa).trim()) {
      return res.status(400).json({ error: 'La placa es obligatoria' });
    }
    const apiKey = `key_${crypto.randomBytes(12).toString('hex')}`;
    const { rows } = await pool.query(
      `INSERT INTO vehiculos (placa, api_key, nombre)
       VALUES ($1, $2, $3) RETURNING id, placa, nombre, activo, fecha_creacion`,
      [String(placa).trim().toUpperCase(), apiKey, nombre || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'La placa ya está registrada' });
    }
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { nombre, activo } = req.body || {};
    const { rows } = await pool.query(
      `UPDATE vehiculos SET
         nombre = COALESCE($2, nombre),
         activo = COALESCE($3, activo)
       WHERE id = $1
       RETURNING id, placa, nombre, activo, fecha_creacion`,
      [req.params.id, nombre ?? null, typeof activo === 'boolean' ? activo : null]
    );
    if (!rows.length) return res.status(404).json({ error: 'Vehículo no encontrado' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'DELETE FROM vehiculos WHERE id = $1 RETURNING id, placa',
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Vehículo no encontrado' });
    res.json({ message: `Vehículo ${rows[0].placa} eliminado` });
  } catch (err) {
    next(err);
  }
});

router.get('/:id/apikey', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, placa, api_key FROM vehiculos WHERE id = $1',
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Vehículo no encontrado' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/apikey/regenerar', async (req, res, next) => {
  try {
    const apiKey = `key_${crypto.randomBytes(12).toString('hex')}`;
    const { rows } = await pool.query(
      'UPDATE vehiculos SET api_key = $2 WHERE id = $1 RETURNING id, placa, api_key',
      [req.params.id, apiKey]
    );
    if (!rows.length) return res.status(404).json({ error: 'Vehículo no encontrado' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

module.exports = router;