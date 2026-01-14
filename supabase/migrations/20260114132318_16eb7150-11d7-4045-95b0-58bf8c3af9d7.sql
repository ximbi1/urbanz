-- =====================================================
-- FIX: Restringir acceso a datos sensibles en profiles
-- Crear vista pública con solo campos necesarios para rankings/display
-- Restringir acceso directo a la tabla base
-- =====================================================

-- 1. Crear vista pública que solo expone campos necesarios para rankings y display público
CREATE OR REPLACE VIEW public.profiles_public
WITH (security_invoker=on) AS
SELECT 
  id,
  username,
  avatar_url,
  color,
  total_points,
  total_territories,
  total_distance,
  current_streak,
  season_points,
  historical_points,
  current_league,
  previous_league,
  league_shard,
  social_league,
  social_points,
  explorer_mode,
  created_at
  -- EXCLUYE: bio, gender, height (datos personales sensibles)
FROM public.profiles;

-- 2. Eliminar la política actual que permite lectura pública de TODOS los campos
DROP POLICY IF EXISTS "Los perfiles son visibles por todos" ON public.profiles;

-- 3. Crear nueva política: usuarios autenticados solo pueden ver SU PROPIO perfil completo
CREATE POLICY "Users can view own full profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- 4. Dar permiso de SELECT en la vista pública a usuarios autenticados
GRANT SELECT ON public.profiles_public TO authenticated;

-- 5. Política para anónimos: No acceso directo a la tabla base (solo vista)
-- La vista profiles_public hereda el contexto del usuario que consulta