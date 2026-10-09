-- ============================================================
-- FASE 3: Mantenimiento avanzado
--  - Inventario de repuestos + movimientos (entradas/salidas)
--  - Órdenes de trabajo con costos reales (mano de obra + repuestos)
--  - Seguimiento de repuestos usados por orden
-- ============================================================

-- 1) Inventario de repuestos
CREATE TABLE IF NOT EXISTS repuestos (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo         VARCHAR(60) NOT NULL UNIQUE,
  nombre         VARCHAR(120) NOT NULL,
  descripcion    VARCHAR(300),
  categoria      VARCHAR(60),
  unidad         VARCHAR(20) NOT NULL DEFAULT 'UND',
  stock_actual   NUMERIC(12,3) NOT NULL DEFAULT 0,
  stock_minimo   NUMERIC(12,3) NOT NULL DEFAULT 0,
  costo_unitario NUMERIC(12,2) NOT NULL DEFAULT 0,
  ubicacion      VARCHAR(80),
  activo         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_repuestos_nombre ON repuestos (nombre);
CREATE INDEX IF NOT EXISTS idx_repuestos_bajo_stock ON repuestos (activo, stock_actual, stock_minimo);

-- 2) Movimientos de inventario
CREATE TABLE IF NOT EXISTS movimientos_inventario (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repuesto_id    UUID NOT NULL REFERENCES repuestos(id) ON DELETE CASCADE,
  tipo           VARCHAR(20) NOT NULL CHECK (tipo IN ('ENTRADA', 'SALIDA', 'AJUSTE')),
  cantidad       NUMERIC(12,3) NOT NULL,
  costo_unitario NUMERIC(12,2),
  motivo         VARCHAR(200),
  orden_id       UUID,
  usuario        VARCHAR(60),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mov_inv_repuesto ON movimientos_inventario (repuesto_id, created_at DESC);

-- 3) Órdenes de trabajo
CREATE TABLE IF NOT EXISTS ordenes_trabajo (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo          VARCHAR(30) NOT NULL UNIQUE,
  vehiculo_id     UUID NOT NULL REFERENCES vehiculos(id) ON DELETE CASCADE,
  tipo            VARCHAR(20) NOT NULL DEFAULT 'PREVENTIVO'
                  CHECK (tipo IN ('PREVENTIVO', 'CORRECTIVO')),
  estado          VARCHAR(25) NOT NULL DEFAULT 'ABIERTA'
                  CHECK (estado IN ('ABIERTA', 'EN_PROCESO', 'ESPERA_REPUESTOS', 'CERRADA', 'CANCELADA')),
  prioridad       VARCHAR(10) NOT NULL DEFAULT 'MEDIA'
                  CHECK (prioridad IN ('BAJA', 'MEDIA', 'ALTA')),
  descripcion     TEXT,
  mecanico        VARCHAR(60),
  sede            VARCHAR(120),
  odometro        INTEGER,
  fecha_apertura  TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_cierre    TIMESTAMPTZ,
  costo_mano_obra NUMERIC(12,2) NOT NULL DEFAULT 0,
  costo_repuestos NUMERIC(12,2) NOT NULL DEFAULT 0,
  costo_total     NUMERIC(12,2) NOT NULL DEFAULT 0,
  mantenimiento_id UUID REFERENCES mantenimientos(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ot_vehiculo ON ordenes_trabajo (vehiculo_id, fecha_apertura DESC);
CREATE INDEX IF NOT EXISTS idx_ot_estado ON ordenes_trabajo (estado, fecha_apertura DESC);

-- 4) Repuestos usados por orden (permite repuesto libre además del catálogo)
CREATE TABLE IF NOT EXISTS orden_repuestos (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orden_id       UUID NOT NULL REFERENCES ordenes_trabajo(id) ON DELETE CASCADE,
  repuesto_id    UUID REFERENCES repuestos(id) ON DELETE SET NULL,
  descripcion    VARCHAR(200) NOT NULL,
  cantidad       NUMERIC(12,3) NOT NULL DEFAULT 1,
  costo_unitario NUMERIC(12,2) NOT NULL DEFAULT 0,
  subtotal       NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orden_repuestos_orden ON orden_repuestos (orden_id);
