const LEVEL_THRESHOLDS = [
  0,
  100,
  250,
  500,
  850,
  1300,
  1900,
  2600,
  3400,
  4300,
  5300,
  6500,
  7900,
  9500,
  11300,
  13300,
  15500,
  18000,
  20800,
  24000,
]

const metersToKm = (meters: number) => meters / 1000

export const calculateRewardPoints = (distance: number, area: number, isSteal: boolean) => {
  const distancePoints = Math.round(metersToKm(distance) * 10)
  const areaPoints = Math.floor(area / 2000)
  const actionPoints = isSteal ? 75 : 50
  return distancePoints + areaPoints + actionPoints
}

export const calculateLevel = (totalPoints: number) => {
  let level = 1
  for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
    if (totalPoints >= LEVEL_THRESHOLDS[i]) {
      level = i + 1
    } else {
      break
    }
  }
  if (level >= LEVEL_THRESHOLDS.length) {
    const extraLevels = Math.floor((totalPoints - LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1]) / 3000)
    level = LEVEL_THRESHOLDS.length + extraLevels
  }
  return level
}

export const getMaxAreaForLevel = (_level: number) => {
  return 5_000_000
}

export const calculateDefenseBonusMinutes = (level: number): number => {
  if (level >= 11) return 1
  if (level >= 6) return 0.75
  return 0.5
}

export const calculateRequiredPace = (territoryPace: number, level: number): number => {
  const bonus = calculateDefenseBonusMinutes(level)
  const required = territoryPace - bonus
  return Math.max(required, 2.5)
}
