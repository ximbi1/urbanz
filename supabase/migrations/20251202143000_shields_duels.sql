CREATE TYPE public.shield_source AS ENUM ('consumable', 'challenge');
CREATE TYPE public.duel_status AS ENUM ('pending', 'active', 'completed');
CREATE TYPE public.duel_type AS ENUM ('distance', 'territories', 'points', 'arena');

CREATE TABLE IF NOT EXISTS public.user_shields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  source shield_source NOT NULL,
  charges integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.territory_shields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  territory_id uuid NOT NULL REFERENCES public.territories(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  shield_type shield_source NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.duels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenger_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  opponent_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status duel_status NOT NULL DEFAULT 'active',
  duel_type duel_type NOT NULL DEFAULT 'distance',
  target_value integer NOT NULL DEFAULT 20000,
  challenger_progress integer NOT NULL DEFAULT 0,
  opponent_progress integer NOT NULL DEFAULT 0,
  winner_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  arena_name text,
  start_at timestamptz NOT NULL DEFAULT now(),
  end_at timestamptz NOT NULL DEFAULT now() + interval '2 days',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.neutral_arenas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  coordinates jsonb,
  reward_points integer DEFAULT 200
);

ALTER TABLE public.user_shields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.territory_shields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.duels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.neutral_arenas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ver mis escudos" ON public.user_shields FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Gestionar mis escudos" ON public.user_shields FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Agregar escudos" ON public.user_shields FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Eliminar escudos" ON public.user_shields FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Ver escudos de mis territorios" ON public.territory_shields FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Aplicar escudos" ON public.territory_shields FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Remover escudos" ON public.territory_shields FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Ver duelos" ON public.duels FOR SELECT USING (auth.uid() IN (challenger_id, opponent_id));
CREATE POLICY "Crear duelo" ON public.duels FOR INSERT WITH CHECK (auth.uid() = challenger_id);
CREATE POLICY "Actualizar duelo" ON public.duels FOR UPDATE USING (auth.uid() IN (challenger_id, opponent_id));

CREATE POLICY "POIs neutrales visibles" ON public.neutral_arenas FOR SELECT USING (true);

CREATE INDEX IF NOT EXISTS idx_user_shields_user ON public.user_shields(user_id);
CREATE INDEX IF NOT EXISTS idx_territory_shields_territory ON public.territory_shields(territory_id);
CREATE INDEX IF NOT EXISTS idx_duels_users ON public.duels(challenger_id, opponent_id);

INSERT INTO public.neutral_arenas (name, description, coordinates, reward_points)
VALUES
  ('Arena Ciutadella', 'Zona neutral dentro del Parc de la Ciutadella.', '[{"lat":41.3902,"lng":2.1845},{"lat":41.3902,"lng":2.1875},{"lat":41.3920,"lng":2.1875},{"lat":41.3920,"lng":2.1845},{"lat":41.3902,"lng":2.1845}]', 250)
ON CONFLICT DO NOTHING;
