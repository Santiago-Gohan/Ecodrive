-- ============================================================
-- FASE 5: Seguridad y privacidad
--  - Registro de consentimientos (tratamiento de datos personales)
--  - Solicitudes de datos (ARCO: acceso, rectificación, cancelación, oposición)
--  - La política de privacidad se publica en /privacidad
-- ============================================================

CREATE TABLE IF NOT EXISTS consentimientos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo          VARCHAR(30) NOT NULL DEFAULT 'PRIVACIDAD'
                CHECK (tipo IN ('PRIVACIDAD', 'MARKETING', 'TERMINOS')),
  version       VARCHAR(20) NOT NULL,
  identificador VARCHAR(150) NOT NULL,   -- correo, teléfono o placa
  aceptado      BOOLEAN NOT NULL DEFAULT TRUE,
  ip            VARCHAR(60),
  user_agent    VARCHAR(300),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_consent_ident ON consentimientos (identificador, created_at DESC);

CREATE TABLE IF NOT EXISTS solicitudes_datos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo          VARCHAR(20) NOT NULL
                CHECK (tipo IN ('ACCESO', 'RECTIFICACION', 'ELIMINACION', 'OPOSICION')),
  identificador VARCHAR(150) NOT NULL,
  descripcion   TEXT,
  estado        VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE'
                CHECK (estado IN ('PENDIENTE', 'EN_PROCESO', 'RESUELTA', 'RECHAZADA')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  resuelto_en   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_solicitudes_estado ON solicitudes_datos (estado, created_at DESC);
