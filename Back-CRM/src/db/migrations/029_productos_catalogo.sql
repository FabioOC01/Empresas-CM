-- Migracion 029: catalogo de productos y conversion de gastos operativos
-- Ejecutar: psql -U postgres -d crm-b2b -f src/db/migrations/029_productos_catalogo.sql

ALTER TABLE empresas
  ADD COLUMN IF NOT EXISTS productos_catalogo JSONB NOT NULL DEFAULT '[]'::jsonb;

WITH gastos_base AS (
  SELECT
    a.empresa_id,
    LOWER(TRIM(g.elem->>'nombre')) AS nombre_key,
    TRIM(g.elem->>'nombre') AS nombre,
    NULLIF(TRIM(COALESCE(g.elem->>'notas', '')), '') AS descripcion,
    NULLIF(g.elem->>'monto', '')::numeric AS costo,
    g.ord
  FROM actividades a
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE
      WHEN jsonb_typeof(COALESCE(a.gastos_operativos, '[]'::jsonb)) = 'array'
        THEN COALESCE(a.gastos_operativos, '[]'::jsonb)
      ELSE '[]'::jsonb
    END
  ) WITH ORDINALITY AS g(elem, ord)
  WHERE COALESCE(g.elem->>'tipo_linea', '') <> 'producto'
    AND NULLIF(TRIM(g.elem->>'nombre'), '') IS NOT NULL
),
productos_resumen AS (
  SELECT
    empresa_id,
    nombre_key,
    MIN(nombre) AS nombre,
    COALESCE((ARRAY_AGG(descripcion ORDER BY ord) FILTER (WHERE descripcion IS NOT NULL))[1], '') AS descripcion,
    COALESCE((ARRAY_AGG(costo ORDER BY ord) FILTER (WHERE costo IS NOT NULL AND costo > 0))[1], 0) AS costo
  FROM gastos_base
  GROUP BY empresa_id, nombre_key
),
productos_nuevos AS (
  SELECT
    empresa_id,
    jsonb_agg(
      jsonb_build_object(
        'id', 'prod_' || md5(empresa_id || ':' || nombre_key),
        'nombre', nombre,
        'marca', '',
        'modelo', nombre,
        'descripcion', descripcion,
        'costo', costo,
        'unidad', 1,
        'origen', 'migrado'
      )
      ORDER BY nombre
    ) AS productos
  FROM productos_resumen
  GROUP BY empresa_id
),
productos_por_empresa AS (
  SELECT
    empresa_id,
    jsonb_agg(producto) AS productos
  FROM productos_nuevos pn
  CROSS JOIN LATERAL jsonb_array_elements(pn.productos) AS p(producto)
  GROUP BY empresa_id
)
UPDATE empresas e
SET productos_catalogo =
  COALESCE(e.productos_catalogo, '[]'::jsonb) ||
  COALESCE((
    SELECT jsonb_agg(p.producto)
    FROM productos_por_empresa ppe
    CROSS JOIN LATERAL jsonb_array_elements(ppe.productos) AS p(producto)
    WHERE ppe.empresa_id = e.id
      AND NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements(COALESCE(e.productos_catalogo, '[]'::jsonb)) AS actual(producto)
        WHERE actual.producto->>'id' = p.producto->>'id'
      )
  ), '[]'::jsonb)
WHERE EXISTS (
  SELECT 1 FROM productos_por_empresa ppe WHERE ppe.empresa_id = e.id
);

WITH convertidos AS (
  SELECT
    a.id,
    a.empresa_id,
    jsonb_agg(
      CASE
        WHEN COALESCE(g.elem->>'tipo_linea', '') = 'producto' THEN g.elem
        ELSE jsonb_build_object(
          'tipo_linea', 'producto',
          'producto_id', 'prod_' || md5(a.empresa_id || ':' || LOWER(TRIM(COALESCE(g.elem->>'nombre', '')))),
          'nombre', COALESCE(g.elem->>'nombre', ''),
          'marca', '',
          'modelo', COALESCE(g.elem->>'nombre', ''),
          'descripcion', COALESCE(g.elem->>'notas', ''),
          'unidad', 1,
          'costo', COALESCE(NULLIF(g.elem->>'monto', '')::numeric, 0),
          'monto', COALESCE(NULLIF(g.elem->>'monto', '')::numeric, 0),
          'notas', COALESCE(g.elem->>'notas', ''),
          'importacion', false,
          'importacion_monto', 0,
          'origen', 'migrado'
        )
      END
      ORDER BY g.ord
    ) AS gastos_operativos
  FROM actividades a
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE
      WHEN jsonb_typeof(COALESCE(a.gastos_operativos, '[]'::jsonb)) = 'array'
        THEN COALESCE(a.gastos_operativos, '[]'::jsonb)
      ELSE '[]'::jsonb
    END
  ) WITH ORDINALITY AS g(elem, ord)
  GROUP BY a.id, a.empresa_id
)
UPDATE actividades a
SET gastos_operativos = c.gastos_operativos
FROM convertidos c
WHERE a.id = c.id
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(
      CASE
        WHEN jsonb_typeof(COALESCE(a.gastos_operativos, '[]'::jsonb)) = 'array'
          THEN COALESCE(a.gastos_operativos, '[]'::jsonb)
        ELSE '[]'::jsonb
      END
    ) AS g(elem)
    WHERE COALESCE(g.elem->>'tipo_linea', '') <> 'producto'
  );
