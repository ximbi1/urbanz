-- Add tags to territories and map challenges tables
ALTER TABLE public.territories
  ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS poi_summary TEXT;

CREATE TABLE IF NOT EXISTS public.map_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  radius INTEGER NOT NULL DEFAULT 200,
  reward_points INTEGER NOT NULL DEFAULT 150,
  active BOOLEAN NOT NULL DEFAULT true,
  start_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  end_date TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '14 days',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.map_challenge_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL REFERENCES public.map_challenges(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(challenge_id, user_id)
);

ALTER TABLE public.map_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.map_challenge_claims ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Map challenges visibles" ON public.map_challenges;
CREATE POLICY "Map challenges visibles"
ON public.map_challenges FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Map challenge claims visibles" ON public.map_challenge_claims;
CREATE POLICY "Map challenge claims visibles"
ON public.map_challenge_claims FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Insert map challenge claim" ON public.map_challenge_claims;
CREATE POLICY "Insert map challenge claim"
ON public.map_challenge_claims FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_map_challenges_active ON public.map_challenges(active, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_map_challenge_claims_user ON public.map_challenge_claims(user_id);

-- Seed some map challenges in Barcelona
INSERT INTO public.map_challenges (name, description, latitude, longitude, radius, reward_points, start_date, end_date)
VALUES
  ('Reto Ciutadella', 'Conquista alrededor del Parc de la Ciutadella.', 41.3896, 2.1858, 220, 200, now(), now() + interval '21 days'),
  ('Sprint Montjuïc', 'Recorre la ladera de Montjuïc y captura el pin.', 41.3672, 2.1685, 300, 250, now(), now() + interval '21 days'),
  ('Ruta Park Güell', 'Rodea Park Güell para desbloquear recompensa.', 41.4128, 2.1545, 200, 220, now(), now() + interval '21 days')
ON CONFLICT DO NOTHING;
