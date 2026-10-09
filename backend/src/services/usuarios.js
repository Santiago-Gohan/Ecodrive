const bcrypt = require('bcryptjs');
const pool = require('../db');

const ROUNDS = 10;

function hashPassword(password) {
  return bcrypt.hash(String(password), ROUNDS);
}

function verifyPassword(password, hash) {
  if (!hash) return Promise.resolve(false);
  return bcrypt.compare(String(password), hash);
}

async function obtenerPermisos(username) {
  const { rows } = await pool.query(
    `SELECT p.clave_permiso
     FROM usuarios u
     JOIN roles r ON r.id = u.rol_id
     JOIN rol_permiso rp ON rp.rol_id = r.id
     JOIN permisos p ON p.id = rp.permiso_id
     WHERE u.username = $1 AND u.activo = true`,
    [username]
  );
  return rows.map((r) => r.clave_permiso);
}

async function getUsuarioPorUsername(username) {
  const { rows } = await pool.query(
    `SELECT u.*, r.nombre AS rol
     FROM usuarios u
     LEFT JOIN roles r ON r.id = u.rol_id
     WHERE u.username = $1`,
    [username]
  );
  return rows[0] || null;
}

async function getRolId(nombre) {
  const { rows } = await pool.query('SELECT id FROM roles WHERE nombre = $1', [nombre]);
  return rows[0]?.id || null;
}

/**
 * Crea el usuario admin inicial a partir de las variables de entorno
 * ADMIN_USER / ADMIN_PASS si todavía no existe ningún usuario.
 * Así la primera vez se puede entrar y luego gestionar usuarios desde el panel.
 */
async function asegurarAdminInicial() {
  const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM usuarios');
  if (rows[0].n > 0) return;

  const username = process.env.ADMIN_USER || 'admin';
  const password = process.env.ADMIN_PASS || 'admin123';
  const rolId = await getRolId('admin');

  const hash = await hashPassword(password);
  await pool.query(
    `INSERT INTO usuarios (username, password_hash, nombre, rol_id, activo)
     VALUES ($1, $2, $3, $4, true)
     ON CONFLICT (username) DO NOTHING`,
    [username, hash, 'Administrador', rolId]
  );
  console.log(`Usuario admin inicial '${username}' creado (cámbialo en el panel).`);
}

module.exports = {
  hashPassword,
  verifyPassword,
  obtenerPermisos,
  getUsuarioPorUsername,
  getRolId,
  asegurarAdminInicial,
};
