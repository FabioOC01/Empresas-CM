-- Migracion 030: meta semanal de actividades para roles de Marketing.
ALTER TABLE vendedores
  ADD COLUMN IF NOT EXISTS meta_actividades_semanal INTEGER NOT NULL DEFAULT 0;
