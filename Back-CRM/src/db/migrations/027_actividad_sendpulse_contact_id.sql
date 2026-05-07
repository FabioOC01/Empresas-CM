-- Relación entre actividades creadas por webhook y contactos de SendPulse.
ALTER TABLE actividades
  ADD COLUMN IF NOT EXISTS sendpulse_contact_id TEXT;

CREATE INDEX IF NOT EXISTS idx_actividades_sendpulse_contact
  ON actividades (empresa_id, sendpulse_contact_id)
  WHERE sendpulse_contact_id IS NOT NULL AND sendpulse_contact_id <> '';
