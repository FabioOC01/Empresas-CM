-- Migración 013: configuración de empresa
-- Ejecutar: psql -U postgres -d crm-b2b -f src/db/migrations/013_empresa_config.sql

ALTER TABLE empresas
  ADD COLUMN IF NOT EXISTS horario_inicio  TEXT    NOT NULL DEFAULT '09:30',
  ADD COLUMN IF NOT EXISTS horario_fin     TEXT    NOT NULL DEFAULT '18:30',
  ADD COLUMN IF NOT EXISTS dias_laborales  INTEGER[] NOT NULL DEFAULT '{1,2,3,4,5}',
  ADD COLUMN IF NOT EXISTS tasa_sunat      NUMERIC(5,4) NOT NULL DEFAULT 0.295,
  ADD COLUMN IF NOT EXISTS tasa_comision   NUMERIC(5,4) NOT NULL DEFAULT 0.05;
