-- Migración 027: Metas anuales por vendedor y meta global de empresa
-- Ejecutar: psql -U postgres -d crm-b2b -f src/db/migrations/027_metas_anual_y_global.sql

ALTER TABLE vendedores
  ADD COLUMN IF NOT EXISTS meta_rentabilidad_anual NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS meta_facturacion_anual  NUMERIC NOT NULL DEFAULT 0;

ALTER TABLE empresas
  ADD COLUMN IF NOT EXISTS meta_global_rentabilidad NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS meta_global_facturacion  NUMERIC NOT NULL DEFAULT 0;
