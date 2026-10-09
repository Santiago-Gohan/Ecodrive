const crypto = require('crypto');
const pool = require('../db');

const MAX_INTENTOS = 3;

function firmar(secreto, cuerpo) {
  if (!secreto) return null;
  return 'sha256=' + crypto.createHmac('sha256', secreto).update(cuerpo).digest('hex');
}

/**
 * Registra una entrega de webhook para cada endpoint activo suscrito al evento.
 * El envío real se hace de forma asíncrona (no bloquea la petición origen).
 */
async function registrarEvento(evento, payload) {
  try {
    const { rows } = await pool.query(
      `SELECT id, eventos FROM webhooks WHERE activo = true`
    );
    const suscritos = rows.filter((w) =>
      String(w.eventos || '')
        .split(',')
        .map((s) => s.trim())
        .includes(evento)
    );
    for (const w of suscritos) {
      const ins = await pool.query(
        `INSERT INTO webhook_entregas (webhook_id, evento, payload)
         VALUES ($1, $2, $3) RETURNING id`,
        [w.id, evento, JSON.stringify(payload)]
      );
      entregar(ins.rows[0].id).catch((e) =>
        console.error('Error entregando webhook:', e.message)
      );
    }
  } catch (err) {
    console.error('No se pudo registrar el webhook:', err.message);
  }
}

async function entregar(entregaId) {
  const { rows } = await pool.query(
    `SELECT e.*, w.url, w.secreto
     FROM webhook_entregas e
     JOIN webhooks w ON w.id = e.webhook_id
     WHERE e.id = $1`,
    [entregaId]
  );
  if (!rows.length) return;
  const e = rows[0];
  const cuerpo = JSON.stringify(e.payload);
  const headers = {
    'Content-Type': 'application/json',
    'X-EcoDrive-Event': e.evento,
    'X-EcoDrive-Delivery': e.id,
  };
  const firma = firmar(e.secreto, cuerpo);
  if (firma) headers['X-EcoDrive-Signature'] = firma;

  try {
    const resp = await fetch(e.url, {
      method: 'POST',
      headers,
      body: cuerpo,
      signal: AbortSignal.timeout(10000),
    });
    const exito = resp.ok;
    await pool.query(
      `UPDATE webhook_entregas
       SET estado = $2::text, intentos = intentos + 1, http_status = $3,
           error = $4, enviado_en = CASE WHEN $2::text = 'ENVIADO' THEN now() ELSE enviado_en END
       WHERE id = $1`,
      [e.id, exito ? 'ENVIADO' : 'ERROR', resp.status, exito ? null : `HTTP ${resp.status}`]
    );
  } catch (err) {
    await pool.query(
      `UPDATE webhook_entregas
       SET estado = 'ERROR', intentos = intentos + 1, error = $2
       WHERE id = $1`,
      [e.id, String(err.message || err).slice(0, 500)]
    );
  }
}

async function reintentarPendientes() {
  try {
    const { rows } = await pool.query(
      `SELECT id FROM webhook_entregas
       WHERE estado = 'ERROR' AND intentos < $1
         AND created_at > now() - interval '24 hours'
       ORDER BY created_at LIMIT 50`,
      [MAX_INTENTOS]
    );
    for (const r of rows) await entregar(r.id);
  } catch (err) {
    console.error('Error reintentando webhooks:', err.message);
  }
}

module.exports = { registrarEvento, entregar, reintentarPendientes, firmar };
