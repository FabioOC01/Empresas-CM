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
  estado      TEXT NOT NULL,           -- 'Pendiente' | 'En Progreso' | 'Completado' | 'Ganada' | 'Perdida'
  mes         TEXT NOT NULL,           -- 'Enero'…'Diciembre'
  fecha       DATE NOT NULL,
  elapsed     INTEGER DEFAULT 0,       -- segundos acumulados (solo para estado 'En Progreso')
  notas       TEXT DEFAULT '',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  ts_pendiente   TIMESTAMPTZ DEFAULT NULL,
  ts_en_progreso TIMESTAMPTZ DEFAULT NULL,
  ts_completado  TIMESTAMPTZ DEFAULT NULL,
  -- campos de rentabilidad (solo relevantes cuando tipo = 'Venta')
  precio_venta      NUMERIC(12,2) DEFAULT 0,
  costo_base        NUMERIC(12,2) DEFAULT 0,
  gastos_operativos JSONB         DEFAULT '[]',
  ajuste_interno    NUMERIC(12,2) DEFAULT 0,
  fecha_fin         DATE
);

ALTER TABLE vendedores
  ADD COLUMN IF NOT EXISTS email TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS username TEXT,
  ADD COLUMN IF NOT EXISTS password_hash TEXT,
  ADD COLUMN IF NOT EXISTS cargo TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS empresa_id TEXT,
  ADD COLUMN IF NOT EXISTS meta_mensual NUMERIC NOT NULL DEFAULT 5000,
  ADD COLUMN IF NOT EXISTS umbral_comision NUMERIC NOT NULL DEFAULT 8000,
  ADD COLUMN IF NOT EXISTS pct_comision_base NUMERIC(5,4) DEFAULT 0.02,
  ADD COLUMN IF NOT EXISTS pct_comision_bajo NUMERIC(5,4) DEFAULT 0.07,
  ADD COLUMN IF NOT EXISTS pct_comision_alto NUMERIC(5,4) DEFAULT 0.08,
  ADD COLUMN IF NOT EXISTS foto_url TEXT,
  ADD COLUMN IF NOT EXISTS zkbio_employee_code TEXT,
  ADD COLUMN IF NOT EXISTS zkbio_device_name TEXT,
  ADD COLUMN IF NOT EXISTS asistencia_activa BOOLEAN NOT NULL DEFAULT TRUE;

CREATE TABLE IF NOT EXISTS asistencia_marcaciones (
  id                  BIGSERIAL PRIMARY KEY,
  empresa_id          TEXT NOT NULL,
  zkbio_employee_code TEXT NOT NULL,
  attendance_date     DATE NOT NULL,
  event_at            TIMESTAMPTZ NOT NULL,
  device_name         TEXT,
  event_type          TEXT,
  external_key        TEXT NOT NULL,
  source_payload      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (empresa_id, external_key)
);

CREATE TABLE IF NOT EXISTS asistencia_sync_log (
  id               BIGSERIAL PRIMARY KEY,
  empresa_id       TEXT NOT NULL,
  started_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at      TIMESTAMPTZ,
  desde            DATE,
  hasta            DATE,
  status           TEXT NOT NULL DEFAULT 'running',
  records_fetched  INTEGER NOT NULL DEFAULT 0,
  records_inserted INTEGER NOT NULL DEFAULT 0,
  error_message    TEXT
);
