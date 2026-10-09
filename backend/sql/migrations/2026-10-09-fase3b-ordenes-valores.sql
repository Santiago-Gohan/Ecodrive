-- ============================================================
-- FASE 3B: ampliar valores de ordenes_trabajo
--  - tipo: agregar PREDICTIVO (la consola ya lo ofrece)
--  - prioridad: agregar URGENTE
-- ============================================================

ALTER TABLE ordenes_trabajo DROP CONSTRAINT IF EXISTS ordenes_trabajo_tipo_check;
ALTER TABLE ordenes_trabajo ADD CONSTRAINT ordenes_trabajo_tipo_check
  CHECK (tipo IN ('PREVENTIVO', 'CORRECTIVO', 'PREDICTIVO'));

ALTER TABLE ordenes_trabajo DROP CONSTRAINT IF EXISTS ordenes_trabajo_prioridad_check;
ALTER TABLE ordenes_trabajo ADD CONSTRAINT ordenes_trabajo_prioridad_check
  CHECK (prioridad IN ('BAJA', 'MEDIA', 'ALTA', 'URGENTE'));