-- Actualizar fechas de misiones activas para que siempre haya misiones disponibles
UPDATE missions 
SET start_date = NOW(), 
    end_date = NOW() + INTERVAL '7 days'
WHERE active = true;

-- Insertar nuevas misiones si no hay suficientes
INSERT INTO missions (title, description, mission_type, target_count, reward_points, reward_shields, active, start_date, end_date)
SELECT * FROM (VALUES
  ('Conquista parques urbanos', 'Captura 3 territorios etiquetados como parque durante la semana.', 'park', 3, 150, 0, true, NOW(), NOW() + INTERVAL '7 days'),
  ('Ruta de hidratación', 'Visita 5 fuentes diferentes mientras corres por la ciudad.', 'fountain', 5, 0, 1, true, NOW(), NOW() + INTERVAL '7 days'),
  ('Dominio de barrios', 'Completa 2 barrios para demostrar tu control.', 'district', 2, 200, 0, true, NOW(), NOW() + INTERVAL '7 days'),
  ('Explorador de parques', 'Conquista 5 parques diferentes esta semana.', 'park', 5, 250, 1, true, NOW(), NOW() + INTERVAL '7 days'),
  ('Circuito de fuentes', 'Encuentra y pasa por 3 fuentes en una sola carrera.', 'fountain', 3, 100, 0, true, NOW(), NOW() + INTERVAL '7 days')
) AS new_missions(title, description, mission_type, target_count, reward_points, reward_shields, active, start_date, end_date)
WHERE NOT EXISTS (
  SELECT 1 FROM missions m 
  WHERE m.active = true 
  AND m.end_date > NOW()
  LIMIT 1
);