-- Posible fecha de terminar la actividad
ALTER TABLE actividades
  ADD COLUMN IF NOT EXISTS fecha_fin DATE;
