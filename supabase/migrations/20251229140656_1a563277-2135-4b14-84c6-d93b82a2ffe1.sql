-- Añadir campo social_points para trackear puntos de Liga Social separados
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS social_points integer DEFAULT 0;

-- Comentario explicativo
COMMENT ON COLUMN public.profiles.social_points IS 'Puntos acumulados en Liga Social, separados de season_points (competitivo)';