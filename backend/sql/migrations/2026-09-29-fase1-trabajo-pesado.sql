-- Fase 1 "trabajo pesado": índices para volumen + tabla de resumen horario.
-- Los índices evitan escaneos completos en historial/dashboard con cientos de miles de lecturas.

CREATE INDEX IF NOT EXISTS idx_telemetria_vehiculo_fecha
  ON telemetria_lectura (vehiculo_id, fecha_registro DESC);

CREATE INDEX IF NOT EXISTS idx_alertas_vehiculo_estado
  ON alerta_mantenimiento (vehiculo_id, estado);

CREATE INDEX IF NOT EXISTS idx_mantenimientos_vehiculo_fecha
  ON mantenimientos (vehiculo_id, fecha DESC);

CREATE TABLE IF NOT EXISTS telemetria_resumen (
  vehiculo_id        uuid NOT NULL REFERENCES vehiculos(id) ON DELETE CASCADE,
  hora               timestamptz NOT NULL,
  lecturas           integer NOT NULL DEFAULT 1,
  ect_min            numeric(6,2),
  ect_max            numeric(6,2),
  ect_prom           numeric(8,2),
  rpm_max            integer,
  combustible_prom   numeric(5,2),
  PRIMARY KEY (vehiculo_id, hora)
);

CREATE INDEX IF NOT EXISTS idx_resumen_hora ON telemetria_resumen (hora);