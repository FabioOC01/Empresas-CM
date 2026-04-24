-- Migración 015: feriados por empresa
-- Ejecutar: psql -U postgres -d crm-b2b -f src/db/migrations/015_feriados.sql

ALTER TABLE empresas
  ADD COLUMN IF NOT EXISTS feriados JSONB NOT NULL DEFAULT '[]';
