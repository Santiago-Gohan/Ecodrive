-- Fase 0B: vehículos no compatibles (conexión y telemetría manual)
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
