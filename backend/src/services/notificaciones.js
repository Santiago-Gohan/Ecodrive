const pool = require('../db');
const { registrarEvento } = require('./webhooks');

/* ------------------------------------------------------------------ *
 * Plantillas de mensajes por evento
 * ------------------------------------------------------------------ */
function formatear(evento, d = {}) {
  switch (evento) {
    case 'ALERTA_TERMICA':
      return {
        asunto: `🚨 EcoDrive | Sobrecalentamiento ${d.placa || ''}`.trim(),
        mensaje:
          `ALERTA TÉRMICA en el vehículo ${d.placa || '-'}.\n` +
          `Temperatura: ${d.ect ?? '-'} °C (umbral ${d.umbral ?? '-'} °C)\n` +
          `Severidad: ${d.severidad || 'ALTA'}\n` +
          `Hora: ${d.fecha || new Date().toISOString()}\n` +
          `Revísalo en el panel de EcoDrive.`,
      };
    case 'ALERTA_MANTENIMIENTO':
      return {
        asunto: `🔧 EcoDrive | Mantenimiento próximo ${d.placa || ''}`.trim(),
        mensaje:
          `El vehículo ${d.placa || '-'} tiene mantenimiento próximo ` +
          `para el ${d.proximo || '-'}.\nPlaca: ${d.placa || '-'}\nPlan: ${d.plan || 'periódico'}.`,
      };
    case 'EVENTO_VIAL':
      return {
        asunto: `⚠️ EcoDrive | Evento vial ${d.tipo || ''}`.trim(),
        mensaje:
          `Reporte de ${d.tipo || 'evento'} en la vía.\n` +
          `Ubicación: ${d.lat ?? '-'}, ${d.lng ?? '-'}\n` +
          `Detalle: ${d.descripcion || 'sin descripción'}\n` +
          `Reportado por: ${d.placa || 'anónimo'}.`,
      };
    case 'OPINION':
      return {
        asunto: '💬 EcoDrive | Nueva opinión recibida',
        mensaje:
          `Nueva opinión de ${d.nombre || 'un visitante'}:\n"${d.comentario || ''}"\n` +
          `Contacto: ${d.contacto || '-'}`,
      };
    default:
      return { asunto: 'EcoDrive', mensaje: JSON.stringify(d) };
  }
}

async function log({ canal, evento, destino, asunto, mensaje, estado, error, vehiculo_id, alerta_id }) {
  try {
    await pool.query(
      `INSERT INTO notificacion_log
         (canal, evento, destino, asunto, mensaje, estado, error, vehiculo_id, alerta_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        canal, evento, destino ? String(destino).slice(0, 500) : null,
        asunto ? String(asunto).slice(0, 200) : null,
        mensaje ? String(mensaje).slice(0, 4000) : null,
        estado, error ? String(error).slice(0, 1000) : null,
        vehiculo_id || null, alerta_id || null,
      ]
    );
  } catch (err) {
    console.error('No se pudo guardar notificacion_log:', err.message);
  }
}

/* ------------------------------------------------------------------ *
 * Proveedores de envío
 * ------------------------------------------------------------------ */
async function enviarEmail(cfg, destino, asunto, mensaje) {
  const p = cfg.params || {};
  if (p.smtp_host) {
    const nodemailer = require('nodemailer');
    const transport = nodemailer.createTransport({
      host: p.smtp_host,
      port: Number(p.smtp_port || 587),
      secure: Number(p.smtp_port) === 465,
      auth: p.smtp_user ? { user: p.smtp_user, pass: p.smtp_pass } : undefined,
    });
    await transport.sendMail({
      from: p.from || p.smtp_user || 'ecodrive@localhost',
      to: destino,
      subject: asunto,
      text: mensaje,
    });
    return;
  }
  if (p.api_url) {
    const resp = await fetch(p.api_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(p.api_key ? { Authorization: `Bearer ${p.api_key}` } : {}),
        ...(p.api_header_name ? { [p.api_header_name]: p.api_key } : {}),
      },
      body: JSON.stringify({ from: p.from, to: destino, subject: asunto, text: mensaje, html: `<p>${mensaje.replace(/\n/g, '<br>')}</p>` }),
      signal: AbortSignal.timeout(10000),
    });
    if (!resp.ok) throw new Error(`Email API HTTP ${resp.status}`);
    return;
  }
  throw new Error('SIN_PROVEEDOR');
}

async function enviarWhatsApp(cfg, destino, mensaje, asunto) {
  const p = cfg.params || {};
  if (p.callmebot_apikey) {
    const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(destino)}&text=${encodeURIComponent(asunto + '\n' + mensaje)}&apikey=${encodeURIComponent(p.callmebot_apikey)}`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!resp.ok) throw new Error(`CallMeBot HTTP ${resp.status}`);
    return;
  }
  if (p.phone_id && p.token) {
    const resp = await fetch(`https://graph.facebook.com/v20.0/${p.phone_id}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${p.token}` },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: destino,
        type: 'text',
        text: { body: `${asunto}\n${mensaje}` },
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!resp.ok) throw new Error(`WhatsApp Cloud API HTTP ${resp.status}`);
    return;
  }
  if (p.webhook_url) {
    const resp = await fetch(p.webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(p.api_key ? { Authorization: `Bearer ${p.api_key}` } : {}) },
      body: JSON.stringify({ to: destino, message: `${asunto}\n${mensaje}` }),
      signal: AbortSignal.timeout(10000),
    });
    if (!resp.ok) throw new Error(`WhatsApp webhook HTTP ${resp.status}`);
    return;
  }
  throw new Error('SIN_PROVEEDOR');
}

async function enviarSMS(cfg, destino, mensaje) {
  const p = cfg.params || {};
  if (p.account_sid && p.auth_token) {
    const body = new URLSearchParams({ To: destino, From: p.from || '', Body: mensaje });
    const resp = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${p.account_sid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: 'Basic ' + Buffer.from(`${p.account_sid}:${p.auth_token}`).toString('base64'),
        },
        body,
        signal: AbortSignal.timeout(10000),
      }
    );
    if (!resp.ok) throw new Error(`Twilio HTTP ${resp.status}`);
    return;
  }
  throw new Error('SIN_PROVEEDOR');
}

async function enviarWebhookGenerico(cfg, asunto, mensaje, payload) {
  const p = cfg.params || {};
  if (!p.webhook_url) throw new Error('SIN_PROVEEDOR');
  const resp = await fetch(p.webhook_url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(p.api_key ? { Authorization: `Bearer ${p.api_key}` } : {}),
      ...(p.header_name ? { [p.header_name]: p.header_value } : {}),
    },
    body: JSON.stringify({ asunto, mensaje, evento: payload?.evento || null, datos: payload }),
    signal: AbortSignal.timeout(10000),
  });
  if (!resp.ok) throw new Error(`Webhook HTTP ${resp.status}`);
}

/* ------------------------------------------------------------------ *
 * Despacho
 * ------------------------------------------------------------------ */
async function enviarUno(cfg, destino, asunto, mensaje, payload) {
  if (cfg.canal === 'EMAIL') return enviarEmail(cfg, destino, asunto, mensaje);
  if (cfg.canal === 'WHATSAPP') return enviarWhatsApp(cfg, destino, mensaje, asunto);
  if (cfg.canal === 'SMS') return enviarSMS(cfg, destino, mensaje);
  if (cfg.canal === 'WEBHOOK') return enviarWebhookGenerico(cfg, asunto, mensaje, payload);
  throw new Error('Canal desconocido');
}

/**
 * Dispara todas las notificaciones configuradas para un evento.
 * Es tolerante a fallos: nunca lanza; registra el resultado en notificacion_log.
 */
async function despacharEvento(evento, datos = {}) {
  // 1) Webhooks salientes (integración ERP/contabilidad)
  registrarEvento(String(evento).toLowerCase().replace(/_/g, '.'), datos).catch(() => {});

  try {
    const { rows: configs } = await pool.query(
      `SELECT * FROM notificacion_config WHERE evento = $1 AND activo = true`,
      [evento]
    );
    if (!configs.length) return;

    const { asunto, mensaje } = formatear(evento, datos);
    const payload = { evento, ...datos };

    for (const cfg of configs) {
      const destinos = String(cfg.destinatarios || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      if (!destinos.length) {
        // Webhook genérico puede no requerir destinatarios explícitos
        if (cfg.canal === 'WEBHOOK') {
          try {
            await enviarUno(cfg, null, asunto, mensaje, payload);
            await log({ canal: cfg.canal, evento, destino: '(webhook)', asunto, mensaje, estado: 'ENVIADO', vehiculo_id: datos.vehiculoId, alerta_id: datos.alertaId });
          } catch (err) {
            const estado = err.message === 'SIN_PROVEEDOR' ? 'SIN_PROVEEDOR' : 'ERROR';
            await log({ canal: cfg.canal, evento, destino: '(webhook)', asunto, mensaje, estado, error: err.message, vehiculo_id: datos.vehiculoId, alerta_id: datos.alertaId });
          }
        }
        continue;
      }

      for (const destino of destinos) {
        try {
          await enviarUno(cfg, destino, asunto, mensaje, payload);
          await log({ canal: cfg.canal, evento, destino, asunto, mensaje, estado: 'ENVIADO', vehiculo_id: datos.vehiculoId, alerta_id: datos.alertaId });
        } catch (err) {
          const estado = err.message === 'SIN_PROVEEDOR' ? 'SIN_PROVEEDOR' : 'ERROR';
          await log({ canal: cfg.canal, evento, destino, asunto, mensaje, estado, error: err.message, vehiculo_id: datos.vehiculoId, alerta_id: datos.alertaId });
        }
      }
    }
  } catch (err) {
    console.error('Error despachando notificaciones:', err.message);
  }
}

/** Prueba manual de una configuración (usada por el panel). */
async function probar(cfg) {
  const { asunto, mensaje } = formatear(cfg.evento, {
    placa: 'TEST-000',
    ect: 108,
    umbral: 105,
    severidad: 'ALTA',
    fecha: new Date().toISOString(),
  });
  const destinos = String(cfg.destinatarios || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const lista = destinos.length ? destinos : ['(webhook)'];
  const resultados = [];
  for (const destino of lista) {
    try {
      await enviarUno(cfg, destino, '[PRUEBA] ' + asunto, mensaje, { evento: 'PRUEBA' });
      resultados.push({ destino, ok: true });
    } catch (err) {
      resultados.push({ destino, ok: false, error: err.message });
    }
  }
  return resultados;
}

module.exports = { despacharEvento, formatear, probar };
