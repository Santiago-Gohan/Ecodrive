const pool = require('../db');

async function getPermisosPorUsuario(usuario) {
  const { rows } = await pool.query(
    `SELECT p.clave_permiso
     FROM usuarios u
     LEFT JOIN roles r ON r.id = u.rol_id
     LEFT JOIN rol_permiso rp ON rp.rol_id = r.id
     LEFT JOIN permisos p ON p.id = rp.permiso_id
     WHERE u.username = $1 AND u.activo = true AND p.clave_permiso IS NOT NULL`,
    [usuario]
  );
  return rows.map((r) => r.clave_permiso);
}

module.exports = function requierePermiso(clave) {
  return async (req, res, next) => {
    try {
      const user = req.usuario?.sub || req.usuario?.username;
      if (!user) return res.status(401).json({ error: 'No autorizado' });
      const permisos = await getPermisosPorUsuario(user);
      if (!permisos.includes(clave)) {
        return res.status(403).json({ error: 'Permiso insuficiente' });
      }
      next();
    } catch (err) {
      next(err);
    }
  };
};
