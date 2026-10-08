-- EcoDrive - Esquema de Base de Datos (PostgreSQL 16)
-- Tablas: vehiculos, telemetria_lectura, alerta_mantenimiento

DROP TABLE IF EXISTS opiniones CASCADE;
DROP TABLE IF EXISTS alerta_mantenimiento CASCADE;
DROP TABLE IF EXISTS telemetria_lectura CASCADE;
DROP TABLE IF EXISTS vehiculos CASCADE;

CREATE TABLE vehiculos (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  placa         VARCHAR(20) NOT NULL UNIQUE,
  api_key       VARCHAR(64) NOT NULL UNIQUE,
  nombre        VARCHAR(100),
  anio          INTEGER,
  combustible   VARCHAR(20),
  tipo_vehiculo VARCHAR(20) NOT NULL DEFAULT 'CARRO',
  ultimo_mantenimiento DATE,
  proximo_mantenimiento DATE,
  intervalo_mantenimiento INTEGER NOT NULL DEFAULT 180,
  plan_mantenimiento TEXT,
  activo        BOOLEAN NOT NULL DEFAULT TRUE,
  fecha_creacion TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE mantenimientos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehiculo_id UUID NOT NULL REFERENCES vehiculos(id) ON DELETE CASCADE,
  fecha       DATE NOT NULL,
  descripcion TEXT,
  costo       NUMERIC(12,2),
  odometro    INTEGER,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE telemetria_lectura (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehiculo_id    UUID NOT NULL REFERENCES vehiculos(id) ON DELETE CASCADE,
  ect_temperatura DECIMAL(6,2) NOT NULL,
  rpm            INTEGER NOT NULL,
  nivel_combustible DECIMAL(5,2),
  lat            DOUBLE PRECISION,
  lng            DOUBLE PRECISION,
  fecha_registro TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE alerta_mantenimiento (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehiculo_id     UUID NOT NULL REFERENCES vehiculos(id) ON DELETE CASCADE,
  tipo_alerta     VARCHAR(50) NOT NULL,
  severidad       VARCHAR(20) NOT NULL,
  estado          VARCHAR(20) NOT NULL
                  CHECK (estado IN ('PENDIENTE', 'ACTIVA', 'ATENDIDA')),
  fecha_generacion TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE opiniones (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rol         VARCHAR(60),
  temas       VARCHAR(200),
  comentario  TEXT,
  nombre      VARCHAR(80),
  contacto    VARCHAR(120),
  estado      VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE'
              CHECK (estado IN ('PENDIENTE', 'APROBADA', 'RECHAZADA')),
  creado_en   TIMESTAMPTZ NOT NULL DEFAULT now(),
  revisado_en TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_opiniones_estado ON opiniones (estado, creado_en DESC);

CREATE TABLE eventos_viales (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo        VARCHAR(20) NOT NULL
              CHECK (tipo IN ('POLICIA', 'ACCIDENTE', 'RETEN', 'OBRA', 'OTRO')),
  lat         DOUBLE PRECISION NOT NULL,
  lng         DOUBLE PRECISION NOT NULL,
  descripcion VARCHAR(300),
  placa       VARCHAR(20),
  vehiculo_id UUID REFERENCES vehiculos(id) ON DELETE SET NULL,
  creado_en   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_eventos_viales_creado ON eventos_viales (creado_en DESC);

-- RBAC
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
  recurso       VARCHAR(60) NOT NULL,
  accion        VARCHAR(40) NOT NULL,
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

INSERT INTO rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id FROM roles r, permisos p WHERE r.nombre = 'admin'
ON CONFLICT DO NOTHING;

-- Vehículos no compatibles
ALTER TABLE vehiculos ADD COLUMN IF NOT EXISTS tipo_conexion VARCHAR(20) NOT NULL DEFAULT 'OBD'
  CHECK (tipo_conexion IN ('OBD', 'GPS_SOLO', 'MANUAL'));
ALTER TABLE vehiculos ADD COLUMN IF NOT EXISTS permite_lectura_manual BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE vehiculos ADD COLUMN IF NOT EXISTS origen_datos VARCHAR(20) DEFAULT 'MOVIL';

CREATE TABLE IF NOT EXISTS telemetria_manual (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehiculo_id      UUID NOT NULL REFERENCES vehiculos(id) ON DELETE CASCADE,
  odometro_km      NUMERIC(12,3),
  nivel_combustible NUMERIC(5,2),
  lat              DOUBLE PRECISION,
  lng              DOUBLE PRECISION,
  notas            VARCHAR(300),
  creado_por       VARCHAR(60),
  fecha_registro   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_telemetria_manual_vehiculo ON telemetria_manual (vehiculo_id, fecha_registro DESC);

-- Datos semilla (vehículos de demostración)
INSERT INTO vehiculos (placa, api_key, nombre, anio, combustible, tipo_vehiculo) VALUES
  ('ABC-123', 'ECDV-K7M2-RQ9X-D4JA', 'Camioneta Toyota Hilux', 2018, 'DIESEL', 'CAMION'),
  ('XYZ-789', 'ECDV-P3WN-T8AH-C2BZ', 'Bus Mercedes Benz', 2015, 'DIESEL', 'BUS')
ON CONFLICT (placa) DO NOTHING;