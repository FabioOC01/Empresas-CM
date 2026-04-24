-- Migración 001: campos de rentabilidad para actividades tipo Venta
-- Ejecutar: psql -U postgres -d crm-b2b -f src/db/migrations/001_add_venta_rentabilidad.sql

ALTER TABLE actividades
  ADD COLUMN IF NOT EXISTS precio_venta      NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS costo_base        NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gastos_operativos JSONB         DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS ajuste_interno    NUMERIC(12,2) DEFAULT 0;

-- Timestamps de estado (pueden faltar en instalaciones antiguas)
ALTER TABLE actividades
  ADD COLUMN IF NOT EXISTS ts_pendiente   TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ts_en_progreso TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ts_completado  TIMESTAMPTZ DEFAULT NULL;
