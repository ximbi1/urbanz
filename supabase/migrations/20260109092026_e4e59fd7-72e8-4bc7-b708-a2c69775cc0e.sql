-- Ensure a non-recursive membership check exists (bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_member_of_lobby(check_lobby uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.lobby_members AS lm
    WHERE lm.lobby_id = check_lobby
      AND lm.user_id = auth.uid()
  );
$$;

-- Avoid any policy chain recursion by using the function from both tables

-- lobby_members: SELECT
DROP POLICY IF EXISTS "Ver miembros de mi lobby" ON public.lobby_members;
CREATE POLICY "Ver miembros de mi lobby"
ON public.lobby_members
FOR SELECT
USING (
  public.is_member_of_lobby(lobby_id)
  OR user_id = auth.uid()
);

-- lobbies: SELECT
DROP POLICY IF EXISTS "Ver lobbies donde soy miembro" ON public.lobbies;
CREATE POLICY "Ver lobbies donde soy miembro"
ON public.lobbies
FOR SELECT
USING (
  public.is_member_of_lobby(id)
  OR creator_id = auth.uid()
);
