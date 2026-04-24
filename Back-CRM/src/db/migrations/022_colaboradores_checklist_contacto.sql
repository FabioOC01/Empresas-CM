-- Colaboradores + checklist en actividades
ALTER TABLE actividades
  ADD COLUMN IF NOT EXISTS colaboradores JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS checklist     JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Contacto en clientes
ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS contacto TEXT NOT NULL DEFAULT '';

-- Nuevos tipos de actividad para empresa Comutel (Marketing)
UPDATE empresas
SET tipos_actividad = (
  SELECT jsonb_agg(DISTINCT x)
  FROM jsonb_array_elements_text(
    COALESCE(tipos_actividad, '[]'::jsonb)
    || '["Video","P. Gráficas Externas","P. Gráficas Internas","Actividad","Evento"]'::jsonb
  ) AS x
),
rol_tipos = jsonb_set(
  COALESCE(rol_tipos, '{}'::jsonb),
  '{Marketing}',
  '["Publicidad","Redes","Video","P. Gráficas Externas","P. Gráficas Internas","Actividad","Evento"]'::jsonb
)
WHERE id = 'comutel';
