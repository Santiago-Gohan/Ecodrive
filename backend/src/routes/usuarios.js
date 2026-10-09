const router = require('express').Router();
const pool = require('../db');
const adminAuth = require('../middleware/adminAuth');
const requierePermiso = require('../middleware/permAuth');
const { registrar } = require('../services/audit');
const { hashPassword, getRolId } = require('../services/usuarios');

router.use(adminAuth);

/* ---------------- Usuarios ---------------- */

router.get('/', requierePermiso('usuarios:ver'), async (req, res, next) => {
  try {
    const sede = req.query.sede || null;
    const { rows } = await pool.query(
      `SELECT u.id, u.username, u.nombre, u.email, u.telefono, u.sede,
              u.activo, u.debe_cambiar_password, u.ultimo_acceso, u.created_at,
              r.nombre AS rol
       FROM usuarios u
       LEFT JOIN roles r ON r.id = u.rol_id
       WHERE ($1::text IS NULL OR u.sede = $1)
       ORDER BY u.created_at DESC`,
      [sede]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.post('/', requierePermiso('usuarios:editar'), async (req, res, next) => {
  try {
    const { username, password, nombre, email, telefono, sede, rol } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: 'Usuario y contraseña son obligatorios' });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    }
    const rolId = await getRolId(rol || 'conductor');
    if (!rolId) return res.status(400).json({ error: 'Rol inválido' });

    const hash = await hashPassword(password);
    const { rows } = await pool.query(
      `INSERT INTO usuarios (username, password_hash, nombre, email, telefono, sede, rol_id, activo, debe_cambiar_password)
       VALUES ($1, $2, $3, $4, $5, $6, $7, true, true)
       RETURNING id, username, nombre, email, telefono, sede, activo, created_at`,
      [String(username).trim(), hash, nombre || null, email || null, telefono || null, sede || null, rolId]
    );
    registrar({ usuario: req.usuario.sub, ip: req.ip, recurso: 'usuarios', accion: 'crear', detalles: { username } });
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Ese usuario ya existe' });
    next(err);
  }
});

router.put('/:id', requierePermiso('usuarios:editar'), async (req, res, next) => {
  try {
    const b = req.body || {};
    const campos = [];
    const params = [req.params.id];
    const add = (col, val) => { campos.push(`${col} = $${params.length + 1}`); params.push(val); };

    if ('nombre' in b) add('nombre', b.nombre ?? null);
    if ('email' in b) add('email', b.email ?? null);
    if ('telefono' in b) add('telefono', b.telefono ?? null);
    if ('sede' in b) add('sede', b.sede ?? null);
    if ('activo' in b) add('activo', !!b.activo);
    if ('rol' in b) {
      const rolId = await getRolId(b.rol);
      if (!rolId) return res.status(400).json({ error: 'Rol inválido' });
      add('rol_id', rolId);
    }
    if ('password' in b && b.password) {
      if (String(b.password).length < 6) {
        return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
      }
      add('password_hash', await hashPassword(b.password));
      campos.push('debe_cambiar_password = true');
    }

    if (!campos.length) return res.status(400).json({ error: 'No hay campos para actualizar' });

    const { rows } = await pool.query(
      `UPDATE usuarios SET ${campos.join(', ')} WHERE id = $1
       RETURNING id, username, nombre, email, telefono, sede, activo`,
      params
    );
    if (!rows.length) return res.status(404).json({ error: 'Usuario no encontrado' });
    registrar({ usuario: req.usuario.sub, ip: req.ip, recurso: 'usuarios', accion: 'editar', detalles: { id: req.params.id } });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requierePermiso('usuarios:editar'), async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT u.id, r.nombre AS rol FROM usuarios u
       LEFT JOIN roles r ON r.id = u.rol_id WHERE u.id = $1`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Usuario no encontrado' });
    if (rows[0].rol === 'admin') {
      const admins = await pool.query(
        `SELECT COUNT(*)::int AS n FROM usuarios u JOIN roles r ON r.id = u.rol_id
         WHERE r.nombre = 'admin' AND u.activo = true`
      );
      if (admins.rows[0].n <= 1) {
        return res.status(409).json({ error: 'No puedes eliminar el último administrador' });
      }
    }
    await pool.query('DELETE FROM usuarios WHERE id = $1', [req.params.id]);
    registrar({ usuario: req.usuario.sub, ip: req.ip, recurso: 'usuarios', accion: 'eliminar', detalles: { id: req.params.id } });
    res.json({ message: 'Usuario eliminado' });
  } catch (err) {
    next(err);
  }
});

/* ---------------- Roles y permisos ---------------- */

router.get('/roles', requierePermiso('usuarios:ver'), async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT r.id, r.nombre, r.descripcion,
              COALESCE(array_agg(p.clave_permiso) FILTER (WHERE p.clave_permiso IS NOT NULL), '{}') AS permisos
       FROM roles r
       LEFT JOIN rol_permiso rp ON rp.rol_id = r.id
       LEFT JOIN permisos p ON p.id = rp.permiso_id
       GROUP BY r.id
       ORDER BY r.nombre`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.get('/auditoria', requierePermiso('usuarios:ver'), async (req, res, next) => {
  try {
    const limite = Math.min(parseInt(req.query.limite || '200', 10), 1000);
    const { rows } = await pool.query(
      `SELECT id, usuario, ip, recurso, accion, detalles, created_at
       FROM audit_log ORDER BY created_at DESC LIMIT $1`,
      [limite]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.get('/permisos', requierePermiso('usuarios:ver'), async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, recurso, accion, clave_permiso, descripcion FROM permisos ORDER BY recurso, accion'
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.put('/roles/:id/permisos', requierePermiso('usuarios:editar'), async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { permisos } = req.body || {};
    if (!Array.isArray(permisos)) {
      return res.status(400).json({ error: 'Se espera una lista de claves de permiso' });
    }
    await client.query('BEGIN');
    const rol = await client.query('SELECT id, nombre FROM roles WHERE id = $1', [req.params.id]);
    if (!rol.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Rol no encontrado' });
    }
    await client.query('DELETE FROM rol_permiso WHERE rol_id = $1', [req.params.id]);
    if (permisos.length) {
      await client.query(
        `INSERT INTO rol_permiso (rol_id, permiso_id)
         SELECT $1, p.id FROM permisos p WHERE p.clave_permiso = ANY($2::text[])
         ON CONFLICT DO NOTHING`,
        [req.params.id, permisos]
      );
    }
    await client.query('COMMIT');
    registrar({
      usuario: req.usuario.sub, ip: req.ip, recurso: 'roles', accion: 'set_permisos',
      detalles: { rol: rol.rows[0].nombre, permisos },
    });
    res.json({ message: 'Permisos actualizados' });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

module.exports = router;
