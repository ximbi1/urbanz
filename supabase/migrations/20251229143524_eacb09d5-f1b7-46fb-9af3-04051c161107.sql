-- Drop the restrictive check constraint
ALTER TABLE public.missions DROP CONSTRAINT IF EXISTS missions_mission_type_check;

-- Add weekend_only flag for special weekend missions
ALTER TABLE public.missions ADD COLUMN IF NOT EXISTS weekend_only boolean DEFAULT false;

-- Clear existing missions and add expanded pool
DELETE FROM public.missions;

-- ROTATION SLOT 0 - Regular missions
INSERT INTO public.missions (title, description, mission_type, target_count, reward_points, reward_shields, rotation_slot, weekend_only, active) VALUES
('Primeros pasos', 'Completa 1 carrera hoy', 'runs', 1, 50, 0, 0, false, true),
('Explorador urbano', 'Recorre 3 km en total', 'distance', 3000, 100, 0, 0, false, true),
('Conquistador novato', 'Conquista 2 territorios', 'territories', 2, 75, 0, 0, false, true);

-- ROTATION SLOT 1 - Regular missions
INSERT INTO public.missions (title, description, mission_type, target_count, reward_points, reward_shields, rotation_slot, weekend_only, active) VALUES
('Maratonista', 'Corre 5 km en total', 'distance', 5000, 150, 0, 1, false, true),
('Ladrón de tierras', 'Roba 1 territorio a otro jugador', 'stolen', 1, 100, 1, 1, false, true),
('Constancia', 'Completa 2 carreras', 'runs', 2, 80, 0, 1, false, true);

-- ROTATION SLOT 2 - Regular missions  
INSERT INTO public.missions (title, description, mission_type, target_count, reward_points, reward_shields, rotation_slot, weekend_only, active) VALUES
('Imperio en expansión', 'Conquista 5 territorios', 'territories', 5, 200, 1, 2, false, true),
('Velocista', 'Mantén un ritmo menor a 6:00 min/km en una carrera', 'pace', 6, 120, 0, 2, false, true),
('Dedicación', 'Completa 3 carreras', 'runs', 3, 100, 0, 2, false, true);

-- ROTATION SLOT 3 - Regular missions
INSERT INTO public.missions (title, description, mission_type, target_count, reward_points, reward_shields, rotation_slot, weekend_only, active) VALUES
('Caminante incansable', 'Recorre 8 km en total', 'distance', 8000, 180, 0, 3, false, true),
('Defensor', 'Mantén 3 territorios sin perderlos', 'defense', 3, 150, 1, 3, false, true),
('Ritmo constante', 'Corre con ritmo menor a 7:00 min/km', 'pace', 7, 90, 0, 3, false, true);

-- ROTATION SLOT 4 - Regular missions
INSERT INTO public.missions (title, description, mission_type, target_count, reward_points, reward_shields, rotation_slot, weekend_only, active) VALUES
('Mega conquistador', 'Conquista 8 territorios', 'territories', 8, 300, 1, 4, false, true),
('Resistencia', 'Corre 10 km en total', 'distance', 10000, 250, 0, 4, false, true),
('Guerrero territorial', 'Roba 3 territorios', 'stolen', 3, 200, 1, 4, false, true);

-- WEEKEND SPECIAL MISSIONS (better rewards!)
INSERT INTO public.missions (title, description, mission_type, target_count, reward_points, reward_shields, rotation_slot, weekend_only, active) VALUES
('🌟 Maratón de fin de semana', 'Recorre 15 km durante el fin de semana', 'distance', 15000, 500, 2, 0, true, true),
('🏆 Dominio total', 'Conquista 10 territorios este fin de semana', 'territories', 10, 400, 2, 0, true, true),
('⚡ Racha imparable', 'Completa 5 carreras este fin de semana', 'runs', 5, 350, 1, 0, true, true),
('🔥 Conquistador supremo', 'Roba 5 territorios este fin de semana', 'stolen', 5, 450, 2, 0, true, true),
('💪 Ultra resistencia', 'Corre 20 km durante el fin de semana', 'distance', 20000, 600, 3, 0, true, true);