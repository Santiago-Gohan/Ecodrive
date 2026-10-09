const router = require('express').Router();
const pool = require('../db');
const adminAuth = require('../middleware/adminAuth');
const requierePermiso = require('../middleware/permAuth');
const { registrar } = require('../services/audit');
const { despacharEvento } = require('../services/notificaciones');

router.use(adminAuth);

function codigoOT() {
  const d = new Date();
  const ymd = d.toISOString().slice(0, 10).replace(/-/g, '');
  const rnd = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `OT-${ymd}-${rnd}`;
}

/* ================= INVENTARIO DE REPUESTOS ================= */

router.get('/repuestos', requierePermiso('inventario:ver'), async (req, res, next) => {
  try {
    const soloBajo = req.query.bajo_stock === '1' || req.query.bajo_stock === 'true';
    const { rows } = await pool.query(
      `SELECT id, codigo, nombre, descripcion, categoria, unidad,
              stock_actual, stock_minimo, costo_unitario, ubicacion, activo,
              (stock_actual <= stock_minimo) AS bajo_stock
       FROM repuestos
       WHERE ($1::boolean IS FALSE OR stock_actual <= stock_minimo)
       ORDER BY nombre`,
      [soloBajo]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.post('/repuestos', requierePermiso('inventario:editar'), async (req, res, next) => {
  try {
    const { codigo, nombre, descripcion, categoria, unidad, stock_actual, stock_minimo, costo_unitario, ubicacion } = req.body || {};
    if (!codigo || !nombre) return res.status(400).json({ error: 'Código y nombre son obligatorios' });
    const { rows } = await pool.query(
      `INSERT INTO repuestos (codigo, nombre, descripcion, categoria, unidad, stock_actual, stock_minimo, costo_unitario, ubicacion)
       VALUES ($1,$2,$3,$4,$5,COALESCE($6,0),COALESCE($7,0),COALESCE($8,0),$9)
       RETURNING *`,
      [String(codigo).trim().toUpperCase(), nombre, descripcion || null, categoria || null,
       unidad || 'UND', Number(stock_actual) || 0, Number(stock_minimo) || 0, Number(costo_unitario) || 0, ubicacion || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Ese código de repuesto ya existe' });
    next(err);
  }
});

router.put('/repuestos/:id', requierePermiso('inventario:editar'), async (req, res, next) => {
  try {
    const b = req.body || {};
    const cols = ['nombre', 'descripcion', 'categoria', 'unidad', 'stock_minimo', 'costo_unitario', 'ubicacion', 'activo'];
    const campos = [];
    const params = [req.params.id];
    for (const c of cols) {
      if (c in b) { campos.push(`${c} = $${params.length + 1}`); params.push(b[c]); }
    }
    if (!campos.length) return res.status(400).json({ error: 'No hay campos para actualizar' });
    campos.push('updated_at = now()');
    const { rows } = await pool.query(
      `UPDATE repuestos SET ${campos.join(', ')} WHERE id = $1 RETURNING *`, params
    );
    if (!rows.length) return res.status(404).json({ error: 'Repuesto no encontrado' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

router.delete('/repuestos/:id', requierePermiso('inventario:editar'), async (req, res, next) => {
  try {
    const { rows } = await pool.query('DELETE FROM repuestos WHERE id = $1 RETURNING id', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Repuesto no encontrado' });
    res.json({ message: 'Repuesto eliminado' });
  } catch (err) {
    next(err);
  }
});

router.get('/repuestos/:id/movimientos', requierePermiso('inventario:ver'), async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT m.id, m.tipo, m.cantidad, m.costo_unitario, m.motivo, m.orden_id, m.usuario, m.created_at,
              o.codigo AS orden_codigo
       FROM movimientos_inventario m
       LEFT JOIN ordenes_trabajo o ON o.id = m.orden_id
       WHERE m.repuesto_id = $1
       ORDER BY m.created_at DESC LIMIT 200`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.post('/repuestos/:id/movimientos', requierePermiso('inventario:editar'), async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { tipo, cantidad, costo_unitario, motivo } = req.body || {};
    if (!['ENTRADA', 'SALIDA', 'AJUSTE'].includes(tipo)) {
      return res.status(400).json({ error: 'Tipo de movimiento inválido' });
    }
    const cant = Number(cantidad);
    if (!Number.isFinite(cant) || cant < 0) return res.status(400).json({ error: 'Cantidad inválida' });

    await client.query('BEGIN');
    const rep = await client.query('SELECT * FROM repuestos WHERE id = $1 FOR UPDATE', [req.params.id]);
    if (!rep.rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Repuesto no encontrado' }); }
    const actual = Number(rep.rows[0].stock_actual);
    let nuevo = actual;
    if (tipo === 'ENTRADA') nuevo = actual + cant;
    if (tipo === 'SALIDA') nuevo = actual - cant;
    if (tipo === 'AJUSTE') nuevo = cant;

    await client.query('UPDATE repuestos SET stock_actual = $2, updated_at = now() WHERE id = $1', [req.params.id, nuevo]);
    const mov = await client.query(
      `INSERT INTO movimientos_inventario (repuesto_id, tipo, cantidad, costo_unitario, motivo, usuario)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [req.params.id, tipo, cant, costo_unitario != null ? Number(costo_unitario) : null, motivo || null, req.usuario.sub]
    );
    await client.query('COMMIT');
    res.status(201).json({ movimiento: mov.rows[0], stock_actual: nuevo });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

/* ================= ÓRDENES DE TRABAJO ================= */

router.get('/ordenes', requierePermiso('taller:ver'), async (req, res, next) => {
  try {
    const { estado, vehiculo_id, sede } = req.query;
    const { rows } = await pool.query(
      `SELECT o.id, o.codigo, o.vehiculo_id, v.placa, o.tipo, o.estado, o.prioridad,
              o.descripcion, o.mecanico, o.sede, o.odometro,
              o.fecha_apertura, o.fecha_cierre,
              o.costo_mano_obra, o.costo_repuestos, o.costo_total,
              (SELECT COUNT(*) FROM orden_repuestos r WHERE r.orden_id = o.id) AS items
       FROM ordenes_trabajo o
       JOIN vehiculos v ON v.id = o.vehiculo_id
       WHERE ($1::text IS NULL OR o.estado = $1)
         AND ($2::uuid IS NULL OR o.vehiculo_id = $2)
         AND ($3::text IS NULL OR o.sede = $3)
       ORDER BY o.fecha_apertura DESC
       LIMIT 500`,
      [estado || null, vehiculo_id || null, sede || null]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.get('/ordenes/:id', requierePermiso('taller:ver'), async (req, res, next) => {
  try {
    const ot = await pool.query(
      `SELECT o.*, v.placa, v.nombre AS vehiculo_nombre
       FROM ordenes_trabajo o JOIN vehiculos v ON v.id = o.vehiculo_id
       WHERE o.id = $1`,
      [req.params.id]
    );
    if (!ot.rows.length) return res.status(404).json({ error: 'Orden no encontrada' });
    const repuestos = await pool.query(
      `SELECT r.id, r.repuesto_id, r.descripcion, r.cantidad, r.costo_unitario, r.subtotal, r.created_at,
              rep.codigo AS repuesto_codigo
       FROM orden_repuestos r
       LEFT JOIN repuestos rep ON rep.id = r.repuesto_id
       WHERE r.orden_id = $1 ORDER BY r.created_at`,
      [req.params.id]
    );
    res.json({ ...ot.rows[0], repuestos: repuestos.rows });
  } catch (err) {
    next(err);
  }
});

router.post('/ordenes', requierePermiso('taller:crear'), async (req, res, next) => {
  try {
    const { vehiculo_id, tipo, prioridad, descripcion, mecanico, sede, odometro, costo_mano_obra } = req.body || {};
    if (!vehiculo_id) return res.status(400).json({ error: 'El vehículo es obligatorio' });
    const existe = await pool.query('SELECT id FROM vehiculos WHERE id = $1', [vehiculo_id]);
    if (!existe.rows.length) return res.status(404).json({ error: 'Vehículo no encontrado' });

    const { rows } = await pool.query(
      `INSERT INTO ordenes_trabajo (codigo, vehiculo_id, tipo, prioridad, descripcion, mecanico, sede, odometro, costo_mano_obra)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,COALESCE($9,0))
       RETURNING *`,
      [codigoOT(), vehiculo_id, tipo || 'PREVENTIVO', prioridad || 'MEDIA',
       descripcion || null, mecanico || null, sede || null, Number(odometro) || null, Number(costo_mano_obra) || 0]
    );
    registrar({ usuario: req.usuario.sub, ip: req.ip, recurso: 'taller', accion: 'crear_ot', detalles: { codigo: rows[0].codigo } });
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

router.put('/ordenes/:id', requierePermiso('taller:editar'), async (req, res, next) => {
  const client = await pool.connect();
  try {
    const b = req.body || {};
    const cols = ['tipo', 'estado', 'prioridad', 'descripcion', 'mecanico', 'sede', 'odometro', 'costo_mano_obra'];
    const campos = [];
    const params = [req.params.id];
    for (const c of cols) {
      if (c in b) { campos.push(`${c} = $${params.length + 1}`); params.push(b[c]); }
    }
    if (!campos.length) return res.status(400).json({ error: 'No hay campos para actualizar' });
    campos.push('updated_at = now()');
    await client.query('BEGIN');
    const { rows } = await client.query(
      `UPDATE ordenes_trabajo SET ${campos.join(', ')} WHERE id = $1 RETURNING *`, params
    );
    if (!rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Orden no encontrada' }); }
    await recalcular(client, req.params.id);
    await client.query('COMMIT');
    const final = await pool.query('SELECT * FROM ordenes_trabajo WHERE id = $1', [req.params.id]);
    res.json(final.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

router.delete('/ordenes/:id', requierePermiso('taller:eliminar'), async (req, res, next) => {
  try {
    const { rows } = await pool.query('DELETE FROM ordenes_trabajo WHERE id = $1 RETURNING id', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Orden no encontrada' });
    res.json({ message: 'Orden eliminada' });
  } catch (err) {
    next(err);
  }
});

/* --- Repuestos de una orden --- */

router.post('/ordenes/:id/repuestos', requierePermiso('taller:editar'), async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { repuesto_id, descripcion, cantidad, costo_unitario } = req.body || {};
    const cant = Number(cantidad) || 1;
    if (cant <= 0) return res.status(400).json({ error: 'Cantidad inválida' });

    await client.query('BEGIN');
    const ot = await client.query('SELECT id, estado FROM ordenes_trabajo WHERE id = $1 FOR UPDATE', [req.params.id]);
    if (!ot.rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Orden no encontrada' }); }

    let desc = descripcion || 'Repuesto';
    let costo = Number(costo_unitario);

    if (repuesto_id) {
      const rep = await client.query('SELECT * FROM repuestos WHERE id = $1 FOR UPDATE', [repuesto_id]);
      if (!rep.rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Repuesto no encontrado' }); }
      desc = descripcion || rep.rows[0].nombre;
      if (!Number.isFinite(costo)) costo = Number(rep.rows[0].costo_unitario);
      const nuevoStock = Number(rep.rows[0].stock_actual) - cant;
      await client.query('UPDATE repuestos SET stock_actual = $2, updated_at = now() WHERE id = $1', [repuesto_id, nuevoStock]);
      await client.query(
        `INSERT INTO movimientos_inventario (repuesto_id, tipo, cantidad, costo_unitario, motivo, orden_id, usuario)
         VALUES ($1,'SALIDA',$2,$3,$4,$5,$6)`,
        [repuesto_id, cant, costo, 'Consumo en OT', req.params.id, req.usuario.sub]
      );
    }
    if (!Number.isFinite(costo)) costo = 0;

    const item = await client.query(
      `INSERT INTO orden_repuestos (orden_id, repuesto_id, descripcion, cantidad, costo_unitario, subtotal)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [req.params.id, repuesto_id || null, desc, cant, costo, cant * costo]
    );
    await recalcular(client, req.params.id);
    await client.query('COMMIT');
    res.status(201).json(item.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

router.delete('/ordenes/:id/repuestos/:item', requierePermiso('taller:editar'), async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const item = await client.query(
      'SELECT * FROM orden_repuestos WHERE id = $1 AND orden_id = $2 FOR UPDATE',
      [req.params.item, req.params.id]
    );
    if (!item.rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Item no encontrado' }); }
    const it = item.rows[0];
    if (it.repuesto_id) {
      await client.query(
        'UPDATE repuestos SET stock_actual = stock_actual + $2, updated_at = now() WHERE id = $1',
        [it.repuesto_id, it.cantidad]
      );
      await client.query(
        `INSERT INTO movimientos_inventario (repuesto_id, tipo, cantidad, costo_unitario, motivo, orden_id, usuario)
         VALUES ($1,'ENTRADA',$2,$3,$4,$5,$6)`,
        [it.repuesto_id, it.cantidad, it.costo_unitario, 'Devolución por OT', req.params.id, req.usuario.sub]
      );
    }
    await client.query('DELETE FROM orden_repuestos WHERE id = $1', [req.params.item]);
    await recalcular(client, req.params.id);
    await client.query('COMMIT');
    res.json({ message: 'Repuesto eliminado de la orden' });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

/* --- Cerrar orden de trabajo (genera historial de mantenimiento) --- */

router.post('/ordenes/:id/cerrar', requierePermiso('taller:editar'), async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { odometro, crear_mantenimiento } = req.body || {};
    await client.query('BEGIN');
    const ot = await client.query('SELECT * FROM ordenes_trabajo WHERE id = $1 FOR UPDATE', [req.params.id]);
    if (!ot.rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Orden no encontrada' }); }
    const o = ot.rows[0];
    if (o.estado === 'CERRADA') { await client.query('ROLLBACK'); return res.status(409).json({ error: 'La orden ya está cerrada' }); }

    await recalcular(client, req.params.id);
    const total = await client.query('SELECT costo_total FROM ordenes_trabajo WHERE id = $1', [req.params.id]);

    let mantenimientoId = o.mantenimiento_id;
    if (crear_mantenimiento !== false) {
      const fecha = new Date().toISOString().slice(0, 10);
      const m = await client.query(
        `INSERT INTO mantenimientos (vehiculo_id, fecha, descripcion, costo, odometro)
         VALUES ($1, $2::date, $3, $4, $5) RETURNING id`,
        [o.vehiculo_id, fecha, `OT ${o.codigo}: ${o.descripcion || 'mantenimiento'}`,
         total.rows[0].costo_total, odometro || o.odometro]
      );
      mantenimientoId = m.rows[0].id;
      await client.query(
        `UPDATE vehiculos SET ultimo_mantenimiento = GREATEST(COALESCE(ultimo_mantenimiento, $2::date), $2::date),
           proximo_mantenimiento = COALESCE(proximo_mantenimiento, $2::date + (intervalo_mantenimiento || ' days')::interval)
         WHERE id = $1`,
        [o.vehiculo_id, fecha]
      );
    }

    const upd = await client.query(
      `UPDATE ordenes_trabajo
       SET estado = 'CERRADA', fecha_cierre = now(), odometro = COALESCE($2, odometro),
           mantenimiento_id = $3, updated_at = now()
       WHERE id = $1 RETURNING *`,
      [req.params.id, odometro || null, mantenimientoId]
    );
    await client.query('COMMIT');

    const v = await pool.query('SELECT placa FROM vehiculos WHERE id = $1', [o.vehiculo_id]);
    despacharEvento('OT_CERRADA', {
      placa: v.rows[0]?.placa, codigo: o.codigo, costo: upd.rows[0].costo_total,
    }).catch(() => {});

    res.json(upd.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

/* --- Resumen de costos --- */

router.get('/costos/resumen', requierePermiso('reportes:ver'), async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT v.placa,
              COALESCE(SUM(o.costo_total), 0) AS costo_total,
              COALESCE(SUM(o.costo_mano_obra), 0) AS costo_mano_obra,
              COALESCE(SUM(o.costo_repuestos), 0) AS costo_repuestos,
              COUNT(o.id) AS ordenes
       FROM vehiculos v
       LEFT JOIN ordenes_trabajo o ON o.vehiculo_id = v.id AND o.estado = 'CERRADA'
       GROUP BY v.id, v.placa
       ORDER BY costo_total DESC`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

async function recalcular(client, ordenId) {
  const { rows } = await client.query(
    'SELECT COALESCE(SUM(subtotal),0) AS rep FROM orden_repuestos WHERE orden_id = $1',
    [ordenId]
  );
  const rep = Number(rows[0].rep);
  await client.query(
    `UPDATE ordenes_trabajo
     SET costo_repuestos = $2, costo_total = COALESCE(costo_mano_obra,0) + $2, updated_at = now()
     WHERE id = $1`,
    [ordenId, rep]
  );
}

module.exports = router;
