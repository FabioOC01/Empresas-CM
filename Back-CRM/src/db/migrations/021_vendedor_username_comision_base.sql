ALTER TABLE vendedores
  ADD COLUMN IF NOT EXISTS username TEXT,
  ADD COLUMN IF NOT EXISTS pct_comision_base NUMERIC(5,4) NOT NULL DEFAULT 0.02;

UPDATE vendedores
SET username = lower(
  regexp_replace(
    trim(translate(nombre, 'ÁÉÍÓÚáéíóúÑñ', 'AEIOUaeiouNn')),
    '\s+',
    '.',
    'g'
  )
)
WHERE username IS NULL OR trim(username) = '';

ALTER TABLE vendedores
  ALTER COLUMN username SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS vendedores_username_unique
  ON vendedores ((lower(username)));
