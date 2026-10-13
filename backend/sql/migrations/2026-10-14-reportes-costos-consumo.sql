-- Reportes de costos y consumo de combustible
CREATE TABLE IF NOT EXISTS abastecimientos (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehiculo_id    UUID NOT NULL REFERENCES vehiculos(id) ON DELETE CASCADE,
  fecha          DATE NOT NULL,
  odometro_km    NUMERIC(12,3),
  litros         NUMERIC(10,3) NOT NULL CHECK (litros > 0),
  precio_litro   NUMERIC(10,2) NOT NULL DEFAULT 0,
  valor_total    NUMERIC(12,2) GENERATED ALWAYS AS (litros * precio_litro) STORED,
  estacion       VARCHAR(120),
  observacion    VARCHAR(200),
  creado_por     VARCHAR(60),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_abast_vehiculo_fecha ON abastecimientos(vehiculo_id, fecha);
