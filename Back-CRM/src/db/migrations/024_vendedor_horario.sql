-- Horario personalizado por vendedor (override del horario de empresa).
-- Estructura: [{"dia":1,"inicio":"08:30","fin":"17:30"}, ...] dia: 0=Dom .. 6=Sab
ALTER TABLE vendedores
  ADD COLUMN IF NOT EXISTS horario_dias JSONB;

-- Datos por defecto Comutel: L-V 09:30-18:30, Sáb 09:30-14:00, tolerancia 5 min.
UPDATE empresas
SET horario_dias = '[
  {"dia":1,"inicio":"09:30","fin":"18:30"},
  {"dia":2,"inicio":"09:30","fin":"18:30"},
  {"dia":3,"inicio":"09:30","fin":"18:30"},
  {"dia":4,"inicio":"09:30","fin":"18:30"},
  {"dia":5,"inicio":"09:30","fin":"18:30"},
  {"dia":6,"inicio":"09:30","fin":"14:00"}
]'::jsonb,
attendance_config = COALESCE(attendance_config, '{}'::jsonb)
                    || jsonb_build_object(
                         'tolerancia_minutos', 5,
                         'ingreso_esperado', '09:30',
                         'timezone', 'America/Lima'
                       )
WHERE id = 'comutel';

-- Override Sthefania: L-V 08:30-17:30, Sáb 09:30-14:00
UPDATE vendedores
SET horario_dias = '[
  {"dia":1,"inicio":"08:30","fin":"17:30"},
  {"dia":2,"inicio":"08:30","fin":"17:30"},
  {"dia":3,"inicio":"08:30","fin":"17:30"},
  {"dia":4,"inicio":"08:30","fin":"17:30"},
  {"dia":5,"inicio":"08:30","fin":"17:30"},
  {"dia":6,"inicio":"09:30","fin":"14:00"}
]'::jsonb
WHERE empresa_id = 'comutel'
  AND (nombre ILIKE '%Sthefania%' OR nombre ILIKE '%Stefania%');
