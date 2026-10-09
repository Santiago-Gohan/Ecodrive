-- ============================================================
-- FASE 4: Integraciones
--  - Webhooks salientes (ERP/contabilidad: Siigo, SAP, etc.)
--  - Tokens de API para integraciones (plan Flota)
--  - La especificación OpenAPI se sirve en /api/v1/openapi.json
-- ============================================================

CREATE TABLE IF NOT EXISTS webhooks (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre     VARCHAR(120) NOT NULL,
  url        VARCHAR(500) NOT NULL,
  eventos    VARCHAR(300) NOT NULL DEFAULT '',  -- CSV: alerta.termica, mantenimiento.proximo, ot.cerrada, evento.vial
  secreto    VARCHAR(120),                       -- se firma con HMAC-SHA256 (header X-EcoDrive-Signature)
  activo     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS webhook_entregas (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id  UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  evento      VARCHAR(60) NOT NULL,
  payload     JSONB NOT NULL,
  estado      VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE'
              CHECK (estado IN ('PENDIENTE', 'ENVIADO', 'ERROR')),
  intentos    INTEGER NOT NULL DEFAULT 0,
  http_status INTEGER,
  error       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  enviado_en  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_webhook_entregas_estado ON webhook_entregas (estado, created_at DESC);

-- Tokens de API para integraciones de clientes (plan Flota)
CREATE TABLE IF NOT EXISTS api_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      VARCHAR(120) NOT NULL,
  token       VARCHAR(80) NOT NULL UNIQUE,
  activo      BOOLEAN NOT NULL DEFAULT TRUE,
  ultimo_uso  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
