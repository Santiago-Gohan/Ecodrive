const router = require("express").Router();
const pool = require("../db");
const adminAuth = require("../middleware/adminAuth");
const requierePermiso = require("../middleware/permAuth");

router.use(adminAuth);

router.get("/costos", requierePermiso("reportes:ver"), async (req, res, next) => {
  try {
    const { desde, hasta, vehiculo_id } = req.query;
    if (!desde || !hasta) {
      return res.status(400).json({ error: "desde y hasta son obligatorios (YYYY-MM-DD)" });
    }

    const params = [desde, hasta];
    let vehiculoFiltro = "";
    if (vehiculo_id) {
      params.push(vehiculo_id);
      vehiculoFiltro = " AND v.id = $" + params.length;
    }

    const reparaciones = await pool.query(
      `SELECT v.id AS vehiculo_id, v.placa, v.nombre,
              COALESCE(SUM(m.costo), 0) + COALESCE(SUM(CASE WHEN ot.estado='CERRADA' THEN ot.costo_total ELSE 0 END), 0) AS costo_total_reparaciones,
              COUNT(DISTINCT m.id) + COUNT(DISTINCT CASE WHEN ot.estado='CERRADA' THEN ot.id END) AS num_intervenciones
       FROM vehiculos v
       LEFT JOIN mantenimientos m ON m.vehiculo_id = v.id AND m.fecha BETWEEN $1::date AND $2::date
       LEFT JOIN ordenes_trabajo ot ON ot.vehiculo_id = v.id AND ot.estado='CERRADA' AND COALESCE(ot.fecha_cierre::date, ot.fecha_apertura::date) BETWEEN $1::date AND $2::date
       WHERE 1=1 ${vehiculoFiltro}
       GROUP BY v.id, v.placa, v.nombre
       ORDER BY v.placa`,
      params
    );

    const combustible = await pool.query(
      `SELECT v.id AS vehiculo_id, COALESCE(SUM(a.litros), 0) AS litros, COALESCE(SUM(a.valor_total), 0) AS costo_combustible
       FROM vehiculos v
       LEFT JOIN abastecimientos a ON a.vehiculo_id = v.id AND a.fecha BETWEEN $1::date AND $2::date
       WHERE 1=1 ${vehiculoFiltro}
       GROUP BY v.id`,
      params
    );

    const combMap = new Map();
    for (const r of combustible.rows) {
      combMap.set(r.vehiculo_id, r);
    }

    const km = await pool.query(
      `WITH datos AS (
         SELECT vehiculo_id, odometro_km AS odo FROM abastecimientos WHERE fecha BETWEEN $1::date AND $2::date
         UNION ALL
         SELECT vehiculo_id, odometro AS odo FROM mantenimientos WHERE fecha BETWEEN $1::date AND $2::date
         UNION ALL
         SELECT vehiculo_id, odometro AS odo FROM ordenes_trabajo WHERE estado='CERRADA' AND COALESCE(fecha_cierre::date, fecha_apertura::date) BETWEEN $1::date AND $2::date
       )
       SELECT vehiculo_id, MAX(odo) AS max_odo, MIN(odo) AS min_odo, (MAX(odo) - MIN(odo)) AS km_recorridos
       FROM datos WHERE odo IS NOT NULL AND odo > 0
       GROUP BY vehiculo_id`,
      [desde, hasta]
    );

    const kmMap = new Map();
    for (const r of km.rows) {
      kmMap.set(r.vehiculo_id, Number(r.km_recorridos) || 0);
    }

    let histFiltro = vehiculoFiltro.replace("v.id", "m.vehiculo_id");
    const historial = await pool.query(
      `SELECT v.id AS vehiculo_id, v.placa, 'MANTENIMIENTO' AS tipo, m.fecha AS fecha, m.descripcion AS concepto, m.costo, m.odometro
       FROM mantenimientos m
       JOIN vehiculos v ON v.id = m.vehiculo_id
       WHERE m.fecha BETWEEN $1::date AND $2::date ${histFiltro}
       UNION ALL
       SELECT v.id AS vehiculo_id, v.placa, 'OT_CERRADA' AS tipo, COALESCE(ot.fecha_cierre::date, ot.fecha_apertura::date) AS fecha,
              ('OT ' || ot.codigo || ' - ' || COALESCE(ot.descripcion, '')) AS concepto, ot.costo_total AS costo, ot.odometro
       FROM ordenes_trabajo ot
       JOIN vehiculos v ON v.id = ot.vehiculo_id
       WHERE ot.estado='CERRADA' AND COALESCE(ot.fecha_cierre::date, ot.fecha_apertura::date) BETWEEN $1::date AND $2::date ${histFiltro.replace("m.vehiculo_id", "ot.vehiculo_id")}
       ORDER BY placa, fecha DESC, tipo`,
      params
    );

    const resultado = [];
    for (const r of reparaciones.rows) {
      const c = combMap.get(r.vehiculo_id) || { litros: 0, costo_combustible: 0 };
      const kmR = kmMap.get(r.vehiculo_id) || 0;
      const rep = Number(r.costo_total_reparaciones) || 0;
      const comb = Number(c.costo_combustible) || 0;
      const litros = Number(c.litros) || 0;
      const rendimiento = litros > 0 && kmR > 0 ? kmR / litros : null;
      const costoKm = kmR > 0 ? (rep + comb) / kmR : null;
      resultado.push({
        vehiculo_id: r.vehiculo_id,
        placa: r.placa,
        nombre: r.nombre,
        costo_reparaciones: rep,
        costo_combustible: comb,
        litros: litros,
        km_recorridos: Math.round(kmR * 1000) / 1000,
        rendimiento_km_l: rendimiento ? Math.round(rendimiento * 100) / 100 : null,
        costo_total_por_km: costoKm ? Math.round(costoKm * 100) / 100 : null,
        intervenciones: Number(r.num_intervenciones) || 0,
      });
    }

    res.json({ resumen: resultado, historial: historial.rows, desde, hasta });
  } catch (err) {
    next(err);
  }
});

router.get("/abastecimientos", requierePermiso("reportes:ver"), async (req, res, next) => {
  try {
    const { vehiculo_id, limite } = req.query;
    const l = Math.min(parseInt(limite || "50", 10), 200);
    const params = [l];
    let filt = "";
    if (vehiculo_id) {
      params.push(vehiculo_id);
      filt = " WHERE a.vehiculo_id = $2";
    }
    const { rows } = await pool.query(
      `SELECT a.id, a.vehiculo_id, v.placa, a.fecha, a.odometro_km, a.litros, a.precio_litro, a.valor_total, a.estacion, a.observacion, a.creado_por, a.created_at
       FROM abastecimientos a
       JOIN vehiculos v ON v.id = a.vehiculo_id
       ${filt}
       ORDER BY a.fecha DESC, a.created_at DESC
       LIMIT $1`,
      params
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.post("/abastecimientos", requierePermiso("mantenimientos:crear"), async (req, res, next) => {
  try {
    const { vehiculo_id, fecha, odometro_km, litros, precio_litro, estacion, observacion } = req.body || {};
    if (!vehiculo_id || !fecha || !litros || litros <= 0) {
      return res.status(400).json({ error: "vehiculo_id, fecha y litros (>0) son obligatorios" });
    }
    const { rows } = await pool.query(
      `INSERT INTO abastecimientos (vehiculo_id, fecha, odometro_km, litros, precio_litro, estacion, observacion, creado_por)
       VALUES ($1, $2, $3, $4, COALESCE($5, 0), $6, $7, $8)
       RETURNING *`,
      [vehiculo_id, fecha, odometro_km || null, litros, precio_litro || 0, estacion || null, observacion || null, req.usuario?.sub || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
