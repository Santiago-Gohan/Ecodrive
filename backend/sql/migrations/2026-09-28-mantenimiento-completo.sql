-- Migración: mantenimiento completo
-- 1) Tabla de historial de mantenimientos
CREATE TABLE IF NOT EXISTS mantenimientos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehiculo_id UUID NOT NULL REFERENCES vehiculos(id) ON DELETE CASCADE,
  fecha       DATE NOT NULL,
  descripcion TEXT,
  costo       NUMERIC(12,2),
  odometro    INTEGER,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2) Fecha explícita del próximo mantenimiento por vehículo
ALTER TABLE vehiculos ADD COLUMN IF NOT EXISTS proximo_mantenimiento DATE;

-- 3) Historico inicial: pasa ultimo_mantenimiento a la tabla de historial
INSERT INTO mantenimientos (vehiculo_id, fecha)
SELECT v.id, v.ultimo_mantenimiento
FROM vehiculos v
WHERE v.ultimo_mantenimiento IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM mantenimientos m
    WHERE m.vehiculo_id = v.id AND m.fecha = v.ultimo_mantenimiento
  );

-- 4) Proximo por defecto si no existe (ultimo + intervalo)
UPDATE vehiculos SET proximo_mantenimiento =
  ultimo_mantenimiento + (intervalo_mantenimiento || ' days')::interval
WHERE proximo_mantenimiento IS NULL
  AND ultimo_mantenimiento IS NOT NULL
  AND intervalo_mantenimiento IS NOT NULL;