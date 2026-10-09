const router = require('express').Router();
const pool = require('../db');
const adminAuth = require('../middleware/adminAuth');
const requierePermiso = require('../middleware/permAuth');

router.use(adminAuth);

router.get('/telemetria', requierePermiso('reportes:ver'), async (req, res, next) => {
  try {
    const vehiculoId = req.query.vehiculo_id || null;
    const limite = Math.min(parseInt(req.query.limite || '50', 10), 200);

    const { rows } = await pool.query(
      `SELECT t.id, t.vehiculo_id, v.placa, t.ect_temperatura, t.rpm, t.nivel_combustible, t.fecha_registro
       FROM telemetria_lectura t
       JOIN vehiculos v ON v.id = t.vehiculo_id
       WHERE ($1::uuid IS NULL OR t.vehiculo_id = $1)
       ORDER BY t.fecha_registro DESC
       LIMIT $2`,
      [vehiculoId, limite]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.get('/alertas', requierePermiso('dashboard:ver'), async (req, res, next) => {
  try {
    const vehiculoId = req.query.vehiculo_id || null;
    const estado = req.query.estado || null;
    const limite = Math.min(parseInt(req.query.limite || '50', 10), 200);

    const { rows } = await pool.query(
      `SELECT a.id, a.vehiculo_id, v.placa, a.tipo_alerta, a.severidad, a.estado, a.fecha_generacion
       FROM alerta_mantenimiento a
       JOIN vehiculos v ON v.id = a.vehiculo_id
       WHERE ($1::uuid IS NULL OR a.vehiculo_id = $1)
         AND ($2::text IS NULL OR a.estado = $2)
       ORDER BY a.fecha_generacion DESC
       LIMIT $3`,
      [vehiculoId, estado, limite]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.post('/alertas/:id/atender', requierePermiso('mantenimientos:crear'), async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `UPDATE alerta_mantenimiento SET estado = 'ATENDIDA'
       WHERE id = $1 AND estado IN ('PENDIENTE', 'ACTIVA')
       RETURNING id, vehiculo_id, tipo_alerta, severidad, estado, fecha_generacion`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Alerta no encontrada o ya atendida' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

module.exports = router;