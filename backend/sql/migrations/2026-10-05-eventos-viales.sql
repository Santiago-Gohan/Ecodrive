-- Eventos viales reportados por los conductores (versión mínima).
-- Flujo: la app del conductor reporta con su GPS -> el panel los ve en el mapa.
-- Tipos: POLICIA, ACCIDENTE, RETEN, OBRA, OTRO. Los reportes son efímeros:
-- GET /api/v1/eventos solo devuelve los últimos EVENTOS_RETENCION_HORAS horas.

CREATE TABLE IF NOT EXISTS eventos_viales (
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
