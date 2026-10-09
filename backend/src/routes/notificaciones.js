const router = require('express').Router();
const pool = require('../db');
const adminAuth = require('../middleware/adminAuth');
const requierePermiso = require('../middleware/permAuth');
const { registrar } = require('../services/audit');
const { probar: probarEnvio } = require('../services/notificaciones');

const CANALES = ['WHATSAPP', 'EMAIL', 'SMS', 'WEBHOOK'];
const EVENTOS = ['ALERTA_TERMICA', 'ALERTA_MANTENIMIENTO', 'EVENTO_VIAL', 'OPINION'];

router.use(adminAuth);

router.get('/', requierePermiso('notificaciones:ver'), async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, canal, evento, destinatarios, params, activo, updated_at
       FROM notificacion_config ORDER BY evento, canal`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.get('/log', requierePermiso('notificaciones:ver'), async (req, res, next) => {
  try {
    const limite = Math.min(parseInt(req.query.limite || '100', 10), 500);
    const { rows } = await pool.query(
      `SELECT id, canal, evento, destino, asunto, estado, error, created_at
       FROM notificacion_log ORDER BY created_at DESC LIMIT $1`,
      [limite]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.post('/', requierePermiso('notificaciones:editar'), async (req, res, next) => {
  try {
    const { canal, evento, destinatarios, params, activo } = req.body || {};
    if (!CANALES.includes(canal)) return res.status(400).json({ error: 'Canal inválido' });
    if (!EVENTOS.includes(evento)) return res.status(400).json({ error: 'Evento inválido' });

    const { rows } = await pool.query(
      `INSERT INTO notificacion_config (canal, evento, destinatarios, params, activo)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (canal, evento) DO UPDATE
         SET destinatarios = EXCLUDED.destinatarios,
             params = EXCLUDED.params,
             activo = EXCLUDED.activo,
             updated_at = now()
       RETURNING id, canal, evento, destinatarios, params, activo`,
      [canal, evento, destinatarios || null, JSON.stringify(params || {}), activo !== false]
    );
    registrar({ usuario: req.usuario.sub, ip: req.ip, recurso: 'notificaciones', accion: 'guardar', detalles: { canal, evento } });
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', requierePermiso('notificaciones:editar'), async (req, res, next) => {
  try {
    const b = req.body || {};
    const campos = [];
    const params = [req.params.id];
    const add = (c, v) => { campos.push(`${c} = $${params.length + 1}`); params.push(v); };
    if ('destinatarios' in b) add('destinatarios', b.destinatarios ?? null);
    if ('params' in b) add('params', JSON.stringify(b.params || {}));
    if ('activo' in b) add('activo', !!b.activo);
    if (!campos.length) return res.status(400).json({ error: 'No hay campos para actualizar' });
    campos.push('updated_at = now()');
    const { rows } = await pool.query(
      `UPDATE notificacion_config SET ${campos.join(', ')} WHERE id = $1
       RETURNING id, canal, evento, destinatarios, params, activo`,
      params
    );
    if (!rows.length) return res.status(404).json({ error: 'Configuración no encontrada' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requierePermiso('notificaciones:editar'), async (req, res, next) => {
  try {
    const { rows } = await pool.query('DELETE FROM notificacion_config WHERE id = $1 RETURNING id', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Configuración no encontrada' });
    res.json({ message: 'Configuración eliminada' });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/probar', requierePermiso('notificaciones:editar'), async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM notificacion_config WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Configuración no encontrada' });
    const resultados = await probarEnvio(rows[0]);
    res.json({ resultados });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
