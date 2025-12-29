// Sistema de niveles basado en puntos
export interface LevelInfo {
  level: number;
  currentLevelPoints: number;
  nextLevelPoints: number;
  progressPercentage: number;
  pointsToNextLevel: number;
}

// Define los puntos necesarios para cada nivel
// Los niveles aumentan exponencialmente para mantener el desafío
const LEVEL_THRESHOLDS = [
  0,      // Nivel 1
  100,    // Nivel 2
  250,    // Nivel 3
  500,    // Nivel 4
  850,    // Nivel 5
  1300,   // Nivel 6
  1900,   // Nivel 7
  2600,   // Nivel 8
  3400,   // Nivel 9
  4300,   // Nivel 10
  5300,   // Nivel 11
  6500,   // Nivel 12
  7900,   // Nivel 13
  9500,   // Nivel 14
  11300,  // Nivel 15
  13300,  // Nivel 16
  15500,  // Nivel 17
  18000,  // Nivel 18
  20800,  // Nivel 19
  24000,  // Nivel 20
];

export const calculateLevel = (totalPoints: number): LevelInfo => {
  let level = 1;
  let currentLevelPoints = 0;
  let nextLevelPoints = LEVEL_THRESHOLDS[1] || 100;

  // Encontrar el nivel actual
  for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
    if (totalPoints >= LEVEL_THRESHOLDS[i]) {
      level = i + 1;
      currentLevelPoints = LEVEL_THRESHOLDS[i];
      nextLevelPoints = LEVEL_THRESHOLDS[i + 1] || LEVEL_THRESHOLDS[i] + 3000;
    } else {
      break;
    }
  }

  // Si el usuario supera el nivel máximo definido
  if (level >= LEVEL_THRESHOLDS.length) {
    const extraLevels = Math.floor((totalPoints - LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1]) / 3000);
    level = LEVEL_THRESHOLDS.length + extraLevels;
    currentLevelPoints = LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1] + (extraLevels * 3000);
    nextLevelPoints = currentLevelPoints + 3000;
  }

  const pointsInCurrentLevel = totalPoints - currentLevelPoints;
  const pointsNeededForNextLevel = nextLevelPoints - currentLevelPoints;
  const progressPercentage = Math.min((pointsInCurrentLevel / pointsNeededForNextLevel) * 100, 100);
  const pointsToNextLevel = nextLevelPoints - totalPoints;

  return {
    level,
    currentLevelPoints,
    nextLevelPoints,
    progressPercentage,
    pointsToNextLevel: Math.max(0, pointsToNextLevel)
  };
};

// Obtener el título/rango según el nivel
export const getLevelTitle = (level: number): string => {
  if (level >= 20) return '🏆 Leyenda';
  if (level >= 17) return '💎 Élite';
  if (level >= 14) return '⭐ Veterano';
  if (level >= 11) return '🥇 Experto';
  if (level >= 8) return '🥈 Atleta';
  if (level >= 5) return '🥉 Explorador';
  return '🌱 Novato';
};

// Obtener color según el nivel
export const getLevelColor = (level: number): string => {
  if (level >= 20) return 'text-yellow-400';
  if (level >= 17) return 'text-cyan-400';
  if (level >= 14) return 'text-purple-400';
  if (level >= 11) return 'text-orange-400';
  if (level >= 8) return 'text-blue-400';
  if (level >= 5) return 'text-green-400';
  return 'text-muted-foreground';
};
