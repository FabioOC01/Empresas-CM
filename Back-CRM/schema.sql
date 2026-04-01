-- CRM B2B — Schema
-- Ejecutar: psql -U postgres -d crm-b2b -f schema.sql

CREATE TABLE IF NOT EXISTS vendedores (
  id        TEXT PRIMARY KEY,
  nombre    TEXT NOT NULL,
  iniciales TEXT NOT NULL,
  color     TEXT NOT NULL,
  rol       TEXT NOT NULL DEFAULT 'Ventas'
            CHECK (rol IN ('Gerencia','Marketing','Ventas','Retail'))
);

INSERT INTO vendedores VALUES
  ('v1', 'Sthefania Villalobos', 'SV', '#2f6fd4', 'Ventas'),
  ('v2', 'Estefany Condori',     'EC', '#27ae60', 'Ventas'),
  ('v3', 'Erimay Torres',        'ET', '#8e44ad', 'Marketing'),
  ('v4', 'Elias Buitron',        'EB', '#e67e22', 'Retail'),
  ('v5', 'Neithan Ratcliffe',    'NR', '#e74c3c', 'Gerencia'),
  ('v6', 'Elizabeth Escobedo',    'EE', '#1512bb', 'Gerencia')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS actividades (
  id          BIGINT PRIMARY KEY,
  nombre      TEXT NOT NULL,
  tipo        TEXT NOT NULL,
            -- 'Venta' | 'Homologación' | 'Visita' | 'Propuesta' | 'Seguimiento' | 'Administrativa'
            -- 'Oportunidad' | 'Cotización' | 'Publicidad' | 'Piezas gráficas'
  vendedor_id TEXT NOT NULL REFERENCES vendedores(id),
  cliente     TEXT NOT NULL,
  monto       NUMERIC(12,2) DEFAULT 0,
  prioridad   TEXT NOT NULL,           -- 'Alta' | 'Media' | 'Baja'
  estado      TEXT NOT NULL,           -- 'Pendiente' | 'En Progreso' | 'Completado' | 'Cancelado'
  mes         TEXT NOT NULL,           -- 'Enero'…'Diciembre'
  fecha       DATE NOT NULL,
  elapsed     INTEGER DEFAULT 0,       -- segundos acumulados (solo para estado 'En Progreso')
  notas       TEXT DEFAULT '',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
