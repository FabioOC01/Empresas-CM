ALTER TABLE actividades
  ADD COLUMN IF NOT EXISTS business_case JSONB NOT NULL DEFAULT '{}'::jsonb;
