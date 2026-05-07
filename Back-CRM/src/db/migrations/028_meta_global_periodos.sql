-- Migración 028: Meta global mensual y trimestral (la existente se trata como anual)
-- Ejecutar: psql -U postgres -d crm-b2b -f src/db/migrations/028_meta_global_periodos.sql

ALTER TABLE empresas
  ADD COLUMN IF NOT EXISTS meta_global_rentabilidad_mes  NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS meta_global_facturacion_mes   NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS meta_global_rentabilidad_trim NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS meta_global_facturacion_trim  NUMERIC NOT NULL DEFAULT 0;
