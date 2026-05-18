ALTER TABLE clientes
    ADD COLUMN IF NOT EXISTS documento_tipo TEXT NOT NULL DEFAULT '';

UPDATE clientes
SET documento_tipo = CASE
    WHEN ruc ~ '^[0-9]{8}$' THEN 'DNI'
    WHEN ruc ~ '^[0-9]{11}$' THEN 'RUC'
    ELSE ''
END
WHERE COALESCE(documento_tipo, '') = '';

CREATE INDEX IF NOT EXISTS idx_clientes_documento
    ON clientes(empresa_id, documento_tipo, ruc);
