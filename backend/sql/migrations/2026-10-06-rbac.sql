-- Fase 0 RBAC: roles, permisos y usuarios
CREATE TABLE IF NOT EXISTS roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      VARCHAR(40) NOT NULL UNIQUE,
  descripcion VARCHAR(200),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS usuarios (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username      VARCHAR(60) NOT NULL UNIQUE,
  password_hash VARCHAR(255),
  email         VARCHAR(150),
  nombre        VARCHAR(120),
  rol_id        UUID REFERENCES roles(id) ON DELETE SET NULL,
  sede          VARCHAR(120),
  activo        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS permisos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recurso       VARCHAR(60) NOT NULL, -- panel, flota, mantenimientos, taller, reportes, configuracion, eventos, opiniones
  accion        VARCHAR(40) NOT NULL, -- ver, crear, editar, eliminar, aprobar
  clave_permiso VARCHAR(120) NOT NULL UNIQUE,
  descripcion   VARCHAR(200),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rol_permiso (
  rol_id      UUID REFERENCES roles(id) ON DELETE CASCADE,
  permiso_id  UUID REFERENCES permisos(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (rol_id, permiso_id)
);

CREATE TABLE IF NOT EXISTS audit_log (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario    VARCHAR(60),
  ip         VARCHAR(60),
  recurso    VARCHAR(120),
  accion     VARCHAR(60),
  detalles   JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO roles (nombre, descripcion) VALUES
  ('admin', 'Administrador del sistema'),
  ('supervisor_sede', 'Supervisor de sede/subempresa'),
  ('gestor_mantenimiento', 'Gestor de mantenimiento'),
  ('mecanico', 'Mecanico de taller'),
  ('conductor', 'Conductor')
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO permisos (recurso, accion, clave_permiso, descripcion) VALUES
  ('dashboard', 'ver', 'dashboard:ver', 'Ver panel principal'),
  ('flota', 'ver', 'flota:ver', 'Ver flota'),
  ('flota', 'crear', 'flota:crear', 'Registrar vehiculo'),
  ('flota', 'editar', 'flota:editar', 'Editar vehiculo'),
  ('mantenimientos', 'ver', 'mantenimientos:ver', 'Ver mantenimientos'),
  ('mantenimientos', 'crear', 'mantenimientos:crear', 'Crear mantenimiento'),
  ('taller', 'ver', 'taller:ver', 'Ver taller/OT'),
  ('taller', 'crear', 'taller:crear', 'Crear orden de trabajo'),
  ('taller', 'editar', 'taller:editar', 'Gestionar orden de trabajo'),
  ('reportes', 'ver', 'reportes:ver', 'Ver y exportar reportes'),
  ('eventos', 'ver', 'eventos:ver', 'Ver eventos viales'),
  ('opiniones', 'ver', 'opiniones:ver', 'Ver opiniones'),
  ('opiniones', 'aprobar', 'opiniones:aprobar', 'Aprobar/rechazar/eliminar opiniones'),
  ('configuracion', 'ver', 'configuracion:ver', 'Ver configuracion'),
  ('configuracion', 'editar', 'configuracion:editar', 'Modificar configuracion')
ON CONFLICT (clave_permiso) DO NOTHING;

-- asignar permisos admin
INSERT INTO rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id FROM roles r, permisos p WHERE r.nombre = 'admin'
ON CONFLICT DO NOTHING;
