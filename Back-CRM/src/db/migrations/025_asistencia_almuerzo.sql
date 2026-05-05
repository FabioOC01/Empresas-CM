-- Configuracion de almuerzo para asistencia.
-- Se detecta una pareja salida/retorno dentro de esta ventana y se compara contra 60 min.
UPDATE empresas
SET attendance_config = COALESCE(attendance_config, '{}'::jsonb)
                    || jsonb_build_object(
                         'almuerzo_inicio', '12:00',
                         'almuerzo_fin', '16:00',
                         'almuerzo_minutos', 60
                       )
WHERE id = 'comutel';
