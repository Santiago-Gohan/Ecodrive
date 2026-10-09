-- ============================================================
-- FASE 1: RBAC avanzado (usuarios reales, contraseñas cifradas,
-- permisos por rol/sede). Complementa la migración RBAC de Fase 0.
-- ============================================================

-- 1) Campos adicionales de usuario
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS telefono VARCHAR(40);
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS ultimo_acceso TIMESTAMPTZ;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS debe_cambiar_password BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_usuarios_sede ON usuarios (sede);
CREATE INDEX IF NOT EXISTS idx_usuarios_rol ON usuarios (rol_id);

-- 2) Permisos nuevos para los módulos de las fases 2-6
INSERT INTO permisos (recurso, accion, clave_permiso, descripcion) VALUES
  ('usuarios', 'ver', 'usuarios:ver', 'Ver usuarios'),
  ('usuarios', 'editar', 'usuarios:editar', 'Crear/editar/desactivar usuarios y roles'),
  ('notificaciones', 'ver', 'notificaciones:ver', 'Ver configuración de notificaciones'),
  ('notificaciones', 'editar', 'notificaciones:editar', 'Configurar y probar notificaciones'),
  ('integraciones', 'ver', 'integraciones:ver', 'Ver integraciones y webhooks'),
  ('integraciones', 'editar', 'integraciones:editar', 'Gestionar webhooks e integraciones'),
  ('taller', 'eliminar', 'taller:eliminar', 'Eliminar/anular órdenes de trabajo'),
  ('inventario', 'ver', 'inventario:ver', 'Ver inventario de repuestos'),
  ('inventario', 'editar', 'inventario:editar', 'Gestionar inventario de repuestos')
ON CONFLICT (clave_permiso) DO NOTHING;

-- 3) Asignar permisos por rol (los roles existentes en Fase 0)
--    admin: TODOS los permisos
INSERT INTO rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id FROM roles r, permisos p WHERE r.nombre = 'admin'
ON CONFLICT DO NOTHING;

--    supervisor_sede: gestión amplia de su sede, sin configuración sensible
INSERT INTO rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id FROM roles r, permisos p
WHERE r.nombre = 'supervisor_sede' AND p.clave_permiso IN (
  'dashboard:ver','flota:ver','flota:crear','flota:editar',
  'mantenimientos:ver','mantenimientos:crear',
  'taller:ver','taller:crear','taller:editar','taller:eliminar',
  'inventario:ver','inventario:editar',
  'reportes:ver','eventos:ver','opiniones:ver','usuarios:ver',
  'notificaciones:ver','integraciones:ver'
)
ON CONFLICT DO NOTHING;

--    gestor_mantenimiento: foco en taller e inventario
INSERT INTO rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id FROM roles r, permisos p
WHERE r.nombre = 'gestor_mantenimiento' AND p.clave_permiso IN (
  'dashboard:ver','flota:ver',
  'mantenimientos:ver','mantenimientos:crear',
  'taller:ver','taller:crear','taller:editar','taller:eliminar',
  'inventario:ver','inventario:editar',
  'reportes:ver','eventos:ver','notificaciones:ver'
)
ON CONFLICT DO NOTHING;

--    mecanico: ejecuta órdenes de trabajo y consume inventario
INSERT INTO rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id FROM roles r, permisos p
WHERE r.nombre = 'mecanico' AND p.clave_permiso IN (
  'dashboard:ver','flota:ver',
  'mantenimientos:ver','taller:ver','taller:crear','taller:editar',
  'inventario:ver'
)
ON CONFLICT DO NOTHING;

--    conductor: solo lo básico (su app reporta; el panel le muestra lo mínimo)
INSERT INTO rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id FROM roles r, permisos p
WHERE r.nombre = 'conductor' AND p.clave_permiso IN (
  'dashboard:ver','eventos:ver'
)
ON CONFLICT DO NOTHING;

-- 4) Auditoría: índices para consultar por usuario/fecha
CREATE INDEX IF NOT EXISTS idx_audit_usuario ON audit_log (usuario, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_recurso ON audit_log (recurso, created_at DESC);
