-- Migración 002: autenticación de vendedores
-- Ejecutar: psql -U postgres -d crm-b2b -f src/db/migrations/002_add_auth.sql

-- Campos de autenticación en vendedores
ALTER TABLE vendedores
  ADD COLUMN IF NOT EXISTS email         TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- Tabla de roles (puede no existir en instalaciones antiguas)
CREATE TABLE IF NOT EXISTS vendedor_roles (
  vendedor_id TEXT NOT NULL REFERENCES vendedores(id) ON DELETE CASCADE,
  rol         TEXT NOT NULL CHECK (rol IN ('Gerencia','Marketing','Ventas','Retail')),
  PRIMARY KEY (vendedor_id, rol)
);

-- Seed de roles por defecto si la tabla estaba vacía
INSERT INTO vendedor_roles (vendedor_id, rol) VALUES
  ('v1', 'Ventas'),
  ('v2', 'Ventas'),
  ('v3', 'Marketing'),
  ('v4', 'Retail'),
  ('v5', 'Gerencia'),
  ('v6', 'Gerencia')
ON CONFLICT DO NOTHING;

-- Emails por defecto (editables después con el script de seed)
UPDATE vendedores SET email = 'sthefania@cm.pe'  WHERE id = 'v1' AND email IS NULL;
UPDATE vendedores SET email = 'estefany@cm.pe'   WHERE id = 'v2' AND email IS NULL;
UPDATE vendedores SET email = 'erimay@cm.pe'     WHERE id = 'v3' AND email IS NULL;
UPDATE vendedores SET email = 'elias@cm.pe'      WHERE id = 'v4' AND email IS NULL;
UPDATE vendedores SET email = 'neithan@cm.pe'    WHERE id = 'v5' AND email IS NULL;
UPDATE vendedores SET email = 'elizabeth@cm.pe'  WHERE id = 'v6' AND email IS NULL;
