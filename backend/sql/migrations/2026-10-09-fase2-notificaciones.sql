-- ============================================================
-- FASE 2: Notificaciones externas (WhatsApp / Email / SMS / Webhook)
-- El envío es configurable desde el panel; sin proveedor configurado
-- las notificaciones quedan registradas como "SIN_PROVEEDOR".
-- ============================================================

CREATE TABLE IF NOT EXISTS notificacion_config (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canal         VARCHAR(20) NOT NULL
                CHECK (canal IN ('WHATSAPP', 'EMAIL', 'SMS', 'WEBHOOK')),
  evento        VARCHAR(40) NOT NULL
                CHECK (evento IN ('ALERTA_TERMICA', 'ALERTA_MANTENIMIENTO', 'EVENTO_VIAL', 'OPINION')),
  destinatarios VARCHAR(500),           -- teléfonos o correos separados por coma
  params        JSONB NOT NULL DEFAULT '{}'::jsonb, -- remitente, apikey, sid, etc.
  activo        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (canal, evento)
);

CREATE TABLE IF NOT EXISTS notificacion_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canal       VARCHAR(20) NOT NULL,
  evento      VARCHAR(40) NOT NULL,
  destino     VARCHAR(500),
  asunto      VARCHAR(200),
  mensaje     TEXT,
  estado      VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE'
              CHECK (estado IN ('PENDIENTE', 'ENVIADO', 'ERROR', 'SIN_PROVEEDOR')),
  error       TEXT,
  vehiculo_id UUID REFERENCES vehiculos(id) ON DELETE SET NULL,
  alerta_id   UUID,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notif_log_fecha ON notificacion_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notif_log_estado ON notificacion_log (estado, created_at DESC);
