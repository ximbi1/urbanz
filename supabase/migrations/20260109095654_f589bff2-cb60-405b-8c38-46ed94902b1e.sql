-- =====================================================
-- FIX 1: Enable RLS on engagement_messages
-- Esta tabla solo debe ser leída por edge functions (service_role)
-- Los usuarios normales no necesitan acceso directo
-- =====================================================
ALTER TABLE public.engagement_messages ENABLE ROW LEVEL SECURITY;

-- Política: Los usuarios autenticados pueden leer mensajes activos (para preview si necesario)
-- El edge function usa service_role key que bypasea RLS
CREATE POLICY "Authenticated users can read active messages"
ON public.engagement_messages
FOR SELECT
TO authenticated
USING (active = true);

-- =====================================================
-- FIX 2: Fix overly permissive policy on notifications
-- Cada usuario solo debe ver/modificar sus propias notificaciones
-- =====================================================

-- Eliminar políticas existentes que usan USING(true)
DROP POLICY IF EXISTS "Users can view their notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update their notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can delete their notifications" ON public.notifications;
DROP POLICY IF EXISTS "Service can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Enable read access for users" ON public.notifications;
DROP POLICY IF EXISTS "Enable insert for service" ON public.notifications;
DROP POLICY IF EXISTS "Enable update for users" ON public.notifications;
DROP POLICY IF EXISTS "Enable delete for users" ON public.notifications;

-- Crear políticas correctas basadas en user_id
CREATE POLICY "Users can view own notifications"
ON public.notifications
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications"
ON public.notifications
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own notifications"
ON public.notifications
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- INSERT: El service_role (edge functions) puede insertar, 
-- o usuarios autenticados pueden insertar solo para sí mismos
CREATE POLICY "Insert own notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());