-- Permitir que todos puedan ver carreras públicas (además de las propias)
CREATE POLICY "Los usuarios pueden ver carreras públicas"
ON public.runs
FOR SELECT
USING (is_public = true OR auth.uid() = user_id);