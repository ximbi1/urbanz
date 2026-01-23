-- Recrear la vista runs_public con SECURITY INVOKER para usar permisos del usuario que consulta
DROP VIEW IF EXISTS public.runs_public;

CREATE VIEW public.runs_public 
WITH (security_invoker = true) AS
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