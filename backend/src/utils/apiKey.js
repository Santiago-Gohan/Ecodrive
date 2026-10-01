const crypto = require('crypto');

const ABC = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function aleatorio(n) {
  const bytes = crypto.randomBytes(n);
  let out = '';
  for (let i = 0; i < n; i++) {
    out += ABC[bytes[i] % ABC.length];
  }
  return out;
}

function generarApiKey() {
  return `ECDV-${aleatorio(4)}-${aleatorio(4)}-${aleatorio(4)}`;
}

// Código corto de vinculación (6 caracteres) que teclea el conductor en la app.
function generarCodigoVinculo() {
  return aleatorio(6);
}

module.exports = { generarApiKey, generarCodigoVinculo };