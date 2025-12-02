CREATE TABLE IF NOT EXISTS public.engagement_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  preferred_window TEXT NOT NULL DEFAULT 'any', -- morning, afternoon, evening
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.engagement_messages (identifier, title, body, preferred_window)
VALUES
  ('reminder_morning_city', '¿Ya conquistaste hoy?', 'Tu ciudad te espera. Abre URBANZ y defiende tus territorios.', 'morning'),
  ('reminder_morning_friends', 'Corre con tu crew', 'Tus amigos avanzan. Demuestra quién domina la temporada.', 'morning'),
  ('reminder_afternoon_heat', 'Los territorios arden', 'Han atacado varias zonas hoy. Es momento de recuperar el control.', 'afternoon'),
  ('reminder_afternoon_challenge', 'Aún estás a tiempo', 'Completa tu desafío diario antes de que anochezca.', 'afternoon')
ON CONFLICT (identifier) DO NOTHING;
