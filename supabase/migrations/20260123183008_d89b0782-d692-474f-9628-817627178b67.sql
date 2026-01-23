-- Actualizar carreras existentes a públicas (fueron creadas antes del sistema de privacidad)
UPDATE public.runs SET is_public = true WHERE is_public = false;

-- Cambiar el default de la columna a true para nuevas carreras
ALTER TABLE public.runs ALTER COLUMN is_public SET DEFAULT true;

-- Recrear la vista runs_public para que el propietario siempre pueda ver su path
DROP VIEW IF EXISTS public.runs_public;

CREATE VIEW public.runs_public AS
SELECT 
  r.id,
  r.user_id,
  r.distance,
  r.duration,
  r.avg_pace,
  r.territories_conquered,
  r.territories_stolen,
  r.territories_lost,
  r.points_gained,
  r.created_at,
  r.is_public,
  r.league_shard,
  -- Path visible si es pública O si el usuario es el propietario
  CASE 
    WHEN r.is_public = true THEN r.path
    WHEN r.user_id = auth.uid() THEN r.path
    ELSE NULL 
  END AS path
FROM public.runs r;