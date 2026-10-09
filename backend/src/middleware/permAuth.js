const { obtenerPermisos } = require('../services/usuarios');

/**
 * RBAC: exige que el usuario autenticado (JWT) tenga la clave de permiso.
 * Se apoya en las tablas usuarios -> roles -> rol_permiso -> permisos.
 *
 * El rol "admin" siempre pasa (tiene todos los permisos asignados).
 */
function requierePermiso(clave) {
  return async (req, res, next) => {
    try {
      const usuario = req.usuario?.sub || req.usuario?.username;
      if (!usuario) return res.status(401).json({ error: 'No autorizado' });

      if (req.usuario?.role === 'admin') return next();

      const permisos = await obtenerPermisos(usuario);
      if (!permisos.includes(clave)) {
        return res.status(403).json({ error: 'Permiso insuficiente', requerido: clave });
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = requierePermiso;
module.exports.requierePermiso = requierePermiso;
