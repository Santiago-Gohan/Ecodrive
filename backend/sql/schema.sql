-- EcoDrive - Esquema de Base de Datos (PostgreSQL 16)
-- Tablas: vehiculos, telemetria_lectura, alerta_mantenimiento

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
  intervalo_mantenimiento INTEGER NOT NULL DEFAULT 180,
  plan_mantenimiento TEXT,
  activo        BOOLEAN NOT NULL DEFAULT TRUE,
  fecha_creacion TIMESTAMP NOT NULL DEFAULT now()
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

-- Datos semilla (vehículos de demostración)
INSERT INTO vehiculos (placa, api_key, nombre, anio, combustible, tipo_vehiculo) VALUES
  ('ABC-123', 'key_abc123_secret', 'Camioneta Toyota Hilux', 2018, 'DIESEL', 'CAMION'),
  ('XYZ-789', 'key_xyz789_secret', 'Bus Mercedes Benz', 2015, 'DIESEL', 'BUS')
ON CONFLICT (placa) DO NOTHING;