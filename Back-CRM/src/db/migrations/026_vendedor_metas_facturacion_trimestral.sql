-- Metas adicionales por vendedor para la vista de Comisiones/Rentabilidad.
-- meta_mensual se conserva como meta mensual de Rentabilidad Bruta.
ALTER TABLE vendedores
  ADD COLUMN IF NOT EXISTS meta_facturacion_mensual NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS meta_rentabilidad_trimestral NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS meta_facturacion_trimestral NUMERIC NOT NULL DEFAULT 0;

-- Inicializa la meta trimestral de Rentabilidad Bruta con 3x la meta mensual existente.
UPDATE vendedores
SET meta_rentabilidad_trimestral = meta_mensual * 3
WHERE COALESCE(meta_rentabilidad_trimestral, 0) = 0
  AND COALESCE(meta_mensual, 0) > 0;
