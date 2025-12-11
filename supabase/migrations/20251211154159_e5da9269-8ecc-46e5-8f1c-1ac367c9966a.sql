-- Tabla para registrar conquistas de parques
CREATE TABLE public.park_conquests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  park_id UUID NOT NULL REFERENCES public.map_pois(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  conquered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  run_id UUID REFERENCES public.runs(id) ON DELETE SET NULL,
  UNIQUE(park_id) -- Solo un propietario por parque
);

-- Índices para búsquedas rápidas
CREATE INDEX idx_park_conquests_user ON public.park_conquests(user_id);
CREATE INDEX idx_park_conquests_park ON public.park_conquests(park_id);

-- Habilitar RLS
ALTER TABLE public.park_conquests ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Las conquistas de parques son visibles por todos"
ON public.park_conquests
FOR SELECT
USING (true);

CREATE POLICY "Solo roles de servicio pueden registrar conquistas"
ON public.park_conquests
FOR INSERT
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Solo roles de servicio pueden actualizar conquistas"
ON public.park_conquests
FOR UPDATE
USING (auth.role() = 'service_role');

CREATE POLICY "Solo roles de servicio pueden eliminar conquistas"
ON public.park_conquests
FOR DELETE
USING (auth.role() = 'service_role');