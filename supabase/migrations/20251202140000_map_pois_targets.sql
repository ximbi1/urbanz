-- Tabla de puntos de interés urbanos
CREATE TABLE IF NOT EXISTS public.map_pois (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('park','beach','historic','plaza')),
  coordinates JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.map_pois ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "POIs visibles" ON public.map_pois;
CREATE POLICY "POIs visibles" ON public.map_pois FOR SELECT USING (true);

INSERT INTO public.map_pois (name, category, coordinates)
VALUES
  ('Parc de la Ciutadella', 'park', '[{"lat":41.3888,"lng":2.1821},{"lat":41.3922,"lng":2.1821},{"lat":41.3922,"lng":2.1894},{"lat":41.3888,"lng":2.1894},{"lat":41.3888,"lng":2.1821}]'),
  ('Parc de Montjuïc', 'park', '[{"lat":41.3604,"lng":2.1550},{"lat":41.3758,"lng":2.1550},{"lat":41.3758,"lng":2.1810},{"lat":41.3604,"lng":2.1810},{"lat":41.3604,"lng":2.1550}]'),
  ('Park Güell', 'park', '[{"lat":41.4110,"lng":2.1500},{"lat":41.4155,"lng":2.1500},{"lat":41.4155,"lng":2.1590},{"lat":41.4110,"lng":2.1590},{"lat":41.4110,"lng":2.1500}]'),
  ('Platja de la Barceloneta', 'beach', '[{"lat":41.3715,"lng":2.1874},{"lat":41.3770,"lng":2.1874},{"lat":41.3770,"lng":2.2007},{"lat":41.3715,"lng":2.2007},{"lat":41.3715,"lng":2.1874}]'),
  ('Plaça de Catalunya', 'plaza', '[{"lat":41.3845,"lng":2.1698},{"lat":41.3875,"lng":2.1698},{"lat":41.3875,"lng":2.1759},{"lat":41.3845,"lng":2.1759},{"lat":41.3845,"lng":2.1698}]'),
  ('Arc de Triomf', 'historic', '[{"lat":41.3914,"lng":2.1808},{"lat":41.3926,"lng":2.1808},{"lat":41.3926,"lng":2.1835},{"lat":41.3914,"lng":2.1835},{"lat":41.3914,"lng":2.1808}]')
ON CONFLICT DO NOTHING;

-- Tabla para objetivos de desafíos del mapa
CREATE TABLE IF NOT EXISTS public.map_challenge_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL REFERENCES public.map_challenges(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(challenge_id, user_id)
);

ALTER TABLE public.map_challenge_targets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Ver objetivos de mapa" ON public.map_challenge_targets;
CREATE POLICY "Ver objetivos de mapa"
ON public.map_challenge_targets FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Crear objetivo de mapa" ON public.map_challenge_targets;
CREATE POLICY "Crear objetivo de mapa"
ON public.map_challenge_targets FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Eliminar objetivo de mapa" ON public.map_challenge_targets;
CREATE POLICY "Eliminar objetivo de mapa"
ON public.map_challenge_targets FOR DELETE
USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_map_pois_category ON public.map_pois(category);
CREATE INDEX IF NOT EXISTS idx_map_challenge_targets_user ON public.map_challenge_targets(user_id);
