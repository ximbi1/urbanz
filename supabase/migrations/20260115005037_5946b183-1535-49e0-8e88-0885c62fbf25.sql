-- =====================================================
-- FIX: Restringir acceso a datos de ubicación en runs
-- El path GPS es dato sensible - solo visible por el propietario
-- Crear vista pública sin path para el feed de actividad
-- =====================================================

-- 1. Eliminar la política permisiva actual
DROP POLICY IF EXISTS "Las carreras son visibles por todos" ON public.runs;

-- 2. Mantener solo la política de que usuarios ven sus propias carreras
-- (ya existe: "Los usuarios pueden ver sus propias carreras")

-- 3. Crear vista pública SIN el campo path (datos GPS sensibles)
CREATE OR REPLACE VIEW public.runs_public
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
  league_shard
  -- EXCLUYE: path (datos GPS sensibles de ubicación)
FROM public.runs;

-- 4. Dar permiso de SELECT en la vista pública a usuarios autenticados
GRANT SELECT ON public.runs_public TO authenticated;

-- 5. Crear función para verificar si dos usuarios son amigos
CREATE OR REPLACE FUNCTION public.are_friends(user_a uuid, user_b uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.friendships
    WHERE status = 'accepted'
      AND (
        (user_id = user_a AND friend_id = user_b)
        OR (user_id = user_b AND friend_id = user_a)
      )
  )
$$;

-- 6. Crear política para que amigos puedan ver carreras (pero sin path vía vista)
-- Los amigos solo acceden vía runs_public, no a la tabla base
-- La tabla base solo es accesible por el propietario