-- Migración 005: tabla de superadmins (plataforma)
-- Ejecutar: psql -U postgres -d crm-b2b -f src/db/migrations/005_superadmins.sql

CREATE TABLE IF NOT EXISTS superadmins (
  id            TEXT PRIMARY KEY,
  nombre        TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
