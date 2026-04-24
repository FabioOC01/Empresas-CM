-- Migración 014: horario por día (reemplaza los 3 campos de 013)
-- Ejecutar: psql -U postgres -d crm-b2b -f src/db/migrations/014_horario_por_dia.sql

ALTER TABLE empresas
  ADD COLUMN IF NOT EXISTS horario_dias JSONB NOT NULL DEFAULT
    '[{"dia":1,"inicio":"09:30","fin":"18:30"},{"dia":2,"inicio":"09:30","fin":"18:30"},{"dia":3,"inicio":"09:30","fin":"18:30"},{"dia":4,"inicio":"09:30","fin":"18:30"},{"dia":5,"inicio":"09:30","fin":"18:30"}]';

ALTER TABLE empresas
  DROP COLUMN IF EXISTS horario_inicio,
  DROP COLUMN IF EXISTS horario_fin,
  DROP COLUMN IF EXISTS dias_laborales;
