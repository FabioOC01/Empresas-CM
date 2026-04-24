-- Metas individuales por vendedor
ALTER TABLE vendedores
  ADD COLUMN IF NOT EXISTS meta_mensual    NUMERIC NOT NULL DEFAULT 5000,
  ADD COLUMN IF NOT EXISTS umbral_comision NUMERIC NOT NULL DEFAULT 8000;
