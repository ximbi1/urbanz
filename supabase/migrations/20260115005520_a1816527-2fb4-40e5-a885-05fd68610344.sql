-- =====================================================
-- FEATURE: Añadir opción de privacidad a carreras
-- is_public = true: cualquiera puede ver el path GPS
-- is_public = false: solo el propietario ve el path
-- =====================================================

-- 1. Añadir columna is_public a runs (por defecto privado para proteger usuarios existentes)
ALTER TABLE public.runs ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false;

-- 2. Actualizar la vista runs_public para incluir path SOLO si is_public = true
DROP VIEW IF EXISTS public.runs_public;

CREATE VIEW public.runs_public
WITH (security_invoker=on) AS
SELECT 
  id,
  user_id,
  distance,
  duration,
  avg_pace,
  territories_conquered,
  territories_stolen,
  territories_lost,
  points_gained,
  created_at,
  league_shard,
  is_public,
  -- Solo mostrar path si la carrera es pública
  CASE WHEN is_public = true THEN path ELSE NULL END as path
FROM public.runs;

-- 3. Dar permiso de SELECT en la vista pública a usuarios autenticados
GRANT SELECT ON public.runs_public TO authenticated;