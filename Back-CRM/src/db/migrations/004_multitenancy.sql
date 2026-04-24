-- Migración 004: multi-tenancy
-- Ejecutar: psql -U postgres -d crm-b2b -f src/db/migrations/004_multitenancy.sql

-- Tabla de empresas (tenants)
CREATE TABLE IF NOT EXISTS empresas (
  id         TEXT PRIMARY KEY,
  nombre     TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Comutel como primer tenant
INSERT INTO empresas (id, nombre) VALUES ('comutel', 'Comutel Peru')
ON CONFLICT DO NOTHING;

-- empresa_id en vendedores
ALTER TABLE vendedores
  ADD COLUMN IF NOT EXISTS empresa_id TEXT REFERENCES empresas(id);
UPDATE vendedores SET empresa_id = 'comutel' WHERE empresa_id IS NULL;
ALTER TABLE vendedores ALTER COLUMN empresa_id SET NOT NULL;

-- empresa_id en actividades (denormalizado para evitar JOINs extra en cada query)
ALTER TABLE actividades
  ADD COLUMN IF NOT EXISTS empresa_id TEXT REFERENCES empresas(id);
UPDATE actividades SET empresa_id = 'comutel' WHERE empresa_id IS NULL;
ALTER TABLE actividades ALTER COLUMN empresa_id SET NOT NULL;

-- Índices de performance
CREATE INDEX IF NOT EXISTS idx_actividades_empresa ON actividades(empresa_id);
CREATE INDEX IF NOT EXISTS idx_vendedores_empresa  ON vendedores(empresa_id);
