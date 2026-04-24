-- Migracion 020: asistencia de vendedores + integracion ZKBio
-- Ejecutar: psql -U postgres -d crm-b2b -f src/db/migrations/020_asistencia.sql

ALTER TABLE vendedores
  ADD COLUMN IF NOT EXISTS zkbio_employee_code TEXT,
  ADD COLUMN IF NOT EXISTS zkbio_device_name   TEXT,
  ADD COLUMN IF NOT EXISTS asistencia_activa   BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_vendedores_empresa_zkbio
  ON vendedores(empresa_id, zkbio_employee_code);

ALTER TABLE empresas
  ADD COLUMN IF NOT EXISTS attendance_config JSONB NOT NULL DEFAULT
    '{"timezone":"America/Lima","ingreso_esperado":"09:30","tolerancia_minutos":10,"tardanza_modo":"primera_entrada","sedes":[]}'::jsonb;

CREATE TABLE IF NOT EXISTS asistencia_marcaciones (
  id                  BIGSERIAL PRIMARY KEY,
  empresa_id          TEXT NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
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

CREATE INDEX IF NOT EXISTS idx_asistencia_marcaciones_empresa_fecha
  ON asistencia_marcaciones(empresa_id, attendance_date);

CREATE INDEX IF NOT EXISTS idx_asistencia_marcaciones_empresa_codigo
  ON asistencia_marcaciones(empresa_id, zkbio_employee_code);

CREATE TABLE IF NOT EXISTS asistencia_sync_log (
  id               BIGSERIAL PRIMARY KEY,
  empresa_id       TEXT NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  started_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at      TIMESTAMPTZ,
  desde            DATE,
  hasta            DATE,
  status           TEXT NOT NULL DEFAULT 'running',
  records_fetched  INTEGER NOT NULL DEFAULT 0,
  records_inserted INTEGER NOT NULL DEFAULT 0,
  error_message    TEXT
);

CREATE OR REPLACE VIEW asistencia_resumen_diario AS
SELECT
  empresa_id,
  zkbio_employee_code,
  attendance_date AS fecha,
  MIN(event_at) AS primera_entrada,
  MAX(event_at) AS ultima_marcacion,
  CASE WHEN COUNT(*) >= 2 THEN MAX(event_at) END AS ultima_salida,
  COUNT(*) AS total_marcaciones,
  COALESCE(
    MAX(device_name) FILTER (WHERE device_name IS NOT NULL),
    MIN(device_name) FILTER (WHERE device_name IS NOT NULL)
  ) AS sede
FROM asistencia_marcaciones
GROUP BY empresa_id, zkbio_employee_code, attendance_date;
