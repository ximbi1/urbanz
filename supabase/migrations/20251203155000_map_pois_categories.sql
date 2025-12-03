ALTER TABLE public.map_pois DROP CONSTRAINT IF EXISTS map_pois_category_check;
ALTER TABLE public.map_pois ADD CONSTRAINT map_pois_category_check CHECK (category IN ('park','beach','historic','plaza','fountain','district'));
