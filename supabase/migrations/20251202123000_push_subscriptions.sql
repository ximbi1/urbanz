-- Tabla para gestionar suscripciones Web Push
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  expiration_time BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, endpoint)
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Ver mis suscripciones push" ON public.push_subscriptions;
CREATE POLICY "Ver mis suscripciones push"
ON public.push_subscriptions FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Crear suscripción push" ON public.push_subscriptions;
CREATE POLICY "Crear suscripción push"
ON public.push_subscriptions FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Eliminar suscripción push" ON public.push_subscriptions;
CREATE POLICY "Eliminar suscripción push"
ON public.push_subscriptions FOR DELETE
USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.handle_push_updated()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_push_subscriptions_updated ON public.push_subscriptions;
CREATE TRIGGER on_push_subscriptions_updated
  BEFORE UPDATE ON public.push_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.handle_push_updated();
