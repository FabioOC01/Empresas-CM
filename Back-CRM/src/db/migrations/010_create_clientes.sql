CREATE TABLE IF NOT EXISTS clientes (
    id            SERIAL PRIMARY KEY,
    nombre        TEXT        NOT NULL,
    ruc           TEXT        NOT NULL DEFAULT '',
    documento_tipo TEXT       NOT NULL DEFAULT '',
    email         TEXT        NOT NULL DEFAULT '',
    telefono      TEXT        NOT NULL DEFAULT '',
    registrado_por TEXT       REFERENCES vendedores(id) ON DELETE SET NULL,
    empresa_id    TEXT        NOT NULL REFERENCES empresas(id),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clientes_empresa ON clientes(empresa_id);
CREATE INDEX IF NOT EXISTS idx_clientes_nombre  ON clientes(empresa_id, nombre);
