-- ============================================================
-- FASE 6: Hardware
--  - Nuevo tipo de conexión GPS_FIJO (instalación fija / hardwired)
--  - Registro de dispositivos GPS (protocolos tipo JT808/Teltonika/HTTP genérico)
--  Nota: la app nativa iOS queda como roadmap (ver docs/ROADMAP-HARDWARE.md);
--        la API ya soporta el alta de dispositivos GPS fijos.
-- ============================================================

-- 1) Ampliar el CHECK de tipo_conexion para admitir GPS_FIJO
ALTER TABLE vehiculos DROP CONSTRAINT IF EXISTS vehiculos_tipo_conexion_check;
ALTER TABLE vehiculos ADD CONSTRAINT vehiculos_tipo_conexion_check
  CHECK (tipo_conexion IN ('OBD', 'GPS_SOLO', 'GPS_FIJO', 'MANUAL'));

-- 2) Dispositivos GPS / rastreadores instalados en la unidad
CREATE TABLE IF NOT EXISTS dispositivos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehiculo_id UUID REFERENCES vehiculos(id) ON DELETE CASCADE,
  tipo        VARCHAR(20) NOT NULL DEFAULT 'GPS_FIJO'
              CHECK (tipo IN ('GPS_FIJO', 'OBD_BT', 'TELEFONO')),
  imei        VARCHAR(40) UNIQUE,
  modelo      VARCHAR(80),
  fabricante  VARCHAR(80),
  protocolo   VARCHAR(40) NOT NULL DEFAULT 'HTTP_GENERICO'
              CHECK (protocolo IN ('HTTP_GENERICO', 'JT808', 'TELTONIKA', 'MEITRACK')),
  api_key     VARCHAR(64) NOT NULL UNIQUE,
  sim_msisdn  VARCHAR(40),
  ultimo_ping TIMESTAMPTZ,
  activo      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dispositivos_vehiculo ON dispositivos (vehiculo_id, activo);
