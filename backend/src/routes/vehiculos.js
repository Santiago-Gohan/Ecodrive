const router = require('express').Router();
const pool = require('../db');
const adminAuth = require('../middleware/adminAuth');
const { generarApiKey } = require('../utils/apiKey');

router.use(adminAuth);

router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT
         v.id, v.placa, v.nombre, v.anio, v.combustible, v.tipo_vehiculo,
         v.ultimo_mantenimiento, v.intervalo_mantenimiento, v.plan_mantenimiento,
         COALESCE(v.proximo_mantenimiento,
           (v.ultimo_mantenimiento + (v.intervalo_mantenimiento || ' days')::interval)
         ) AS proximo_mantenimiento,
         v.activo, v.fecha_creacion,
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
    const { placa, nombre, tipo, combustible, anio } = req.body || {};
    if (!placa || !String(placa).trim()) {
      return res.status(400).json({ error: 'La placa es obligatoria' });
    }
    const apiKey = generarApiKey();
    const { rows } = await pool.query(
      `INSERT INTO vehiculos (placa, api_key, nombre, tipo_vehiculo, combustible, anio)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, placa, api_key, nombre, anio, combustible, tipo_vehiculo, activo, fecha_creacion`,
      [
        String(placa).trim().toUpperCase(),
        apiKey,
        nombre || null,
        String(tipo || 'CARRO').trim().toUpperCase(),
        (combustible || '').toString().trim().toLowerCase() === 'diesel' ? 'DIESEL' :
          (combustible || '').toString().trim().toLowerCase() === 'gasolina' ? 'GASOLINA' : null,
        Number(anio) || null,
      ]
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
    const b = req.body || {};
    const campos = [];
    const params = [req.params.id];
    if ('nombre' in b) { campos.push(`nombre = $${params.length + 1}`); params.push(b.nombre ?? null); }
    if ('activo' in b) { campos.push(`activo = $${params.length + 1}`); params.push(!!b.activo); }
    if ('intervalo_mantenimiento' in b) {
      const v = Number(b.intervalo_mantenimiento);
      campos.push(`intervalo_mantenimiento = $${params.length + 1}`);
      params.push(Number.isFinite(v) && v > 0 ? v : null);
    }
    if ('plan_mantenimiento' in b) {
      campos.push(`plan_mantenimiento = $${params.length + 1}`);
      params.push(b.plan_mantenimiento ?? null);
    }
    if ('proximo_mantenimiento' in b) {
      const p = b.proximo_mantenimiento ? String(b.proximo_mantenimiento) : null;
      campos.push(`proximo_mantenimiento = $${params.length + 1}::date`);
      params.push(p);
    }
    if (!campos.length) {
      return res.status(400).json({ error: 'No hay campos para actualizar' });
    }
    const { rows } = await pool.query(
      `UPDATE vehiculos SET ${campos.join(', ')}
       WHERE id = $1
       RETURNING id, placa, nombre, activo, fecha_creacion,
         ultimo_mantenimiento, intervalo_mantenimiento, plan_mantenimiento,
         COALESCE(proximo_mantenimiento,
           (ultimo_mantenimiento + (intervalo_mantenimiento || ' days')::interval)
         ) AS proximo_mantenimiento`,
      params
    );
    if (!rows.length) return res.status(404).json({ error: 'Vehículo no encontrado' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM alerta_mantenimiento WHERE vehiculo_id = $1', [req.params.id]);
    await client.query('DELETE FROM telemetria_lectura WHERE vehiculo_id = $1', [req.params.id]);
    const { rows } = await client.query(
      'DELETE FROM vehiculos WHERE id = $1 RETURNING id, placa',
      [req.params.id]
    );
    if (!rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Veh��culo no encontrado' });
    }
    await client.query('COMMIT');
    res.json({ message: `Veh��culo ${rows[0].placa} eliminado` });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
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
    const apiKey = generarApiKey();
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

/* ---------- Historial de mantenimientos ---------- */

router.get('/:id/mantenimientos', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, fecha, descripcion, costo, odometro, created_at
       FROM mantenimientos
       WHERE vehiculo_id = $1
       ORDER BY fecha DESC, created_at DESC`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/mantenimientos', async (req, res, next) => {
  try {
    const { fecha, descripcion, costo, odometro, intervalo_mantenimiento, proximo_mantenimiento } = req.body || {};
    const f = String(fecha || '').trim();
    if (!f || isNaN(Date.parse(f))) {
      return res.status(400).json({ error: 'La fecha del mantenimiento es obligatoria' });
    }

    const costoNum = costo === undefined || costo === null || costo === '' ? null : Number(costo);
    const odomNum = odometro === undefined || odometro === null || odometro === '' ? null : Number(odometro);
    if (costoNum !== null && !Number.isFinite(costoNum)) {
      return res.status(400).json({ error: 'El costo debe ser numérico' });
    }
    if (odomNum !== null && !Number.isFinite(odomNum)) {
      return res.status(400).json({ error: 'El odómetro debe ser numérico' });
    }

    const existe = await pool.query('SELECT id FROM vehiculos WHERE id = $1', [req.params.id]);
    if (!existe.rows.length) return res.status(404).json({ error: 'Vehículo no encontrado' });

    const intervalo = Number(intervalo_mantenimiento);
    const intervaloOk = Number.isFinite(intervalo) && intervalo > 0;
    const proxio = proximo_mantenimiento && String(proximo_mantenimiento).trim()
      ? String(proximo_mantenimiento).trim()
      : null;

    const ins = await pool.query(
      `INSERT INTO mantenimientos (vehiculo_id, fecha, descripcion, costo, odometro)
       VALUES ($1, $2::date, $3, $4, $5) RETURNING id, fecha, descripcion, costo, odometro, created_at`,
      [req.params.id, f, String(descripcion || '').trim() || null, costoNum, odomNum]
    );

    await pool.query(
      `UPDATE vehiculos SET
         ultimo_mantenimiento = GREATEST(COALESCE(ultimo_mantenimiento, $2::date), $2::date),
         intervalo_mantenimiento = CASE WHEN $3::integer > 0 THEN $3 ELSE intervalo_mantenimiento END,
         proximo_mantenimiento = COALESCE(
           $4::date,
           CASE WHEN $3::integer > 0 THEN $2::date + ($3 || ' days')::interval
                ELSE proximo_mantenimiento END
         )
       WHERE id = $1`,
      [req.params.id, f, intervaloOk ? intervalo : null, proxio]
    );

    res.status(201).json(ins.rows[0]);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id/mantenimientos/:mnt', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'DELETE FROM mantenimientos WHERE id = $1 AND vehiculo_id = $2 RETURNING id',
      [req.params.mnt, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Mantenimiento no encontrado' });
    await pool.query(
      `UPDATE vehiculos SET ultimo_mantenimiento =
         (SELECT MAX(fecha) FROM mantenimientos WHERE vehiculo_id = $1)
       WHERE id = $1`,
      [req.params.id]
    );
    res.json({ message: 'Mantenimiento eliminado' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;