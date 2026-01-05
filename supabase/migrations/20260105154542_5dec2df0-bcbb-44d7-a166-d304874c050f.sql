-- Crear tabla de lobbies
CREATE TABLE public.lobbies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  invite_code TEXT NOT NULL UNIQUE DEFAULT upper(substr(md5(random()::text), 1, 6)),
  creator_id UUID NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  max_members INTEGER DEFAULT 20,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Crear tabla de miembros de lobby
CREATE TABLE public.lobby_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lobby_id UUID NOT NULL REFERENCES public.lobbies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(lobby_id, user_id)
);

-- Añadir columna lobby_id a territories
ALTER TABLE public.territories 
ADD COLUMN lobby_id UUID REFERENCES public.lobbies(id) ON DELETE SET NULL;

-- Habilitar RLS
ALTER TABLE public.lobbies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lobby_members ENABLE ROW LEVEL SECURITY;

-- Políticas para lobbies
CREATE POLICY "Ver lobbies donde soy miembro" ON public.lobbies
  FOR SELECT USING (
    id IN (SELECT lobby_id FROM public.lobby_members WHERE user_id = auth.uid())
    OR creator_id = auth.uid()
  );

CREATE POLICY "Crear lobbies" ON public.lobbies
  FOR INSERT WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Actualizar mi lobby" ON public.lobbies
  FOR UPDATE USING (auth.uid() = creator_id);

CREATE POLICY "Eliminar mi lobby" ON public.lobbies
  FOR DELETE USING (auth.uid() = creator_id);

-- Políticas para lobby_members
CREATE POLICY "Ver miembros de mi lobby" ON public.lobby_members
  FOR SELECT USING (
    lobby_id IN (SELECT lobby_id FROM public.lobby_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Unirse a lobby" ON public.lobby_members
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Salir de lobby" ON public.lobby_members
  FOR DELETE USING (auth.uid() = user_id);

-- Índices para rendimiento
CREATE INDEX idx_lobbies_invite_code ON public.lobbies(invite_code);
CREATE INDEX idx_lobby_members_user_id ON public.lobby_members(user_id);
CREATE INDEX idx_lobby_members_lobby_id ON public.lobby_members(lobby_id);
CREATE INDEX idx_territories_lobby_id ON public.territories(lobby_id);

-- Trigger para updated_at
CREATE TRIGGER update_lobbies_updated_at
  BEFORE UPDATE ON public.lobbies
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();