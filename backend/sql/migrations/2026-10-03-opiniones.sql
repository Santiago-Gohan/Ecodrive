-- Opiniones de usuarios: landing -> moderación en el panel -> publicación en la web
-- Flujo: el visitante envía (estado PENDIENTE) -> el admin aprueba/rechaza ->
-- las APROBADA se devuelven en GET /api/v1/opiniones/publicas.

CREATE TABLE IF NOT EXISTS opiniones (
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
