const config = require('../config');

// Ventana deslizante simple por minuto en memoria (por vehículo).
const VENTANA_MS = 60000;
const gastos = new Map();

/**
 * Consume unidades (una por lectura) para una API Key / vehículo.
 * Devuelve { ok } o { ok:false, retrySe } para responder 429.
 */
function consumirCaudal(vehiculoId, unidades) {
  const menos = Math.max(1, Number(unidades) || 1);
  const limite = Math.max(1, config.limiteLecturasMinuto);
  const ahora = Date.now();
  let e = gastos.get(vehiculoId);
  if (!e || ahora - e.inicio >= VENTANA_MS) {
    e = { inicio: ahora, usados: 0 };
    gastos.set(vehiculoId, e);
  }
  if (e.usados + menos > limite) {
    const retry = Math.ceil((e.inicio + VENTANA_MS - ahora) / 1000);
    return { ok: false, retrySe: Math.max(1, retry) };
  }
  e.usados += menos;
  if (gastos.size > 4096) gastos.clear();
  return { ok: true };
}

module.exports = { consumirCaudal };