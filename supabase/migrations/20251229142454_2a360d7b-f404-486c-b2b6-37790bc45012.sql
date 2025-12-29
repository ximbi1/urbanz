-- Añadir columna para el slot de rotación
ALTER TABLE missions ADD COLUMN IF NOT EXISTS rotation_slot integer DEFAULT 0;

-- Eliminar las misiones antiguas y crear un pool de misiones con rotación
DELETE FROM missions;

-- Pool de misiones que rotarán cada 2 días (3 slots = 6 días de ciclo)
INSERT INTO missions (title, description, mission_type, target_count, reward_points, reward_shields, active, rotation_slot) VALUES
-- Slot 0 (días 1-2)
('Conquista parques urbanos', 'Captura 3 territorios etiquetados como parque.', 'park', 3, 150, 0, true, 0),
('Ruta de hidratación', 'Visita 5 fuentes diferentes mientras corres.', 'fountain', 5, 0, 1, true, 0),
('Dominio de barrios', 'Completa 2 barrios para demostrar tu control.', 'district', 2, 200, 0, true, 0),

-- Slot 1 (días 3-4)
('Explorador de parques', 'Conquista 5 parques diferentes.', 'park', 5, 250, 1, true, 1),
('Circuito de fuentes', 'Pasa por 3 fuentes en tus carreras.', 'fountain', 3, 100, 0, true, 1),
('Conquistador urbano', 'Domina 3 barrios completos.', 'district', 3, 300, 0, true, 1),

-- Slot 2 (días 5-6)
('Maratón verde', 'Conquista 7 parques esta semana.', 'park', 7, 400, 1, true, 2),
('Cazador de fuentes', 'Encuentra y visita 8 fuentes.', 'fountain', 8, 200, 1, true, 2),
('Emperador de barrios', 'Controla 4 barrios diferentes.', 'district', 4, 500, 1, true, 2);