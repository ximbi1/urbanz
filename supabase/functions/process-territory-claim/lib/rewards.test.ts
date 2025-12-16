import { assertAlmostEquals, assertEquals } from 'https://deno.land/std@0.190.0/testing/asserts.ts'
import { calculateRequiredPace, calculateRewardPoints, getMaxAreaForLevel } from './rewards.ts'

Deno.test('calculateRequiredPace enforces minimum pace', () => {
  const pace = calculateRequiredPace(2.0, 20)
  assertAlmostEquals(pace, 2.5, 0.01)
})

Deno.test('calculateRewardPoints combines distance, area and action', () => {
  const points = calculateRewardPoints(5000, 4000, true)
  // 5km -> 50 pts, area 4000 -> 2 pts, steal bonus 75
  assertEquals(points, 127)
})

Deno.test('getMaxAreaForLevel caps area to 5km2', () => {
  assertEquals(getMaxAreaForLevel(1), 5_000_000)
  assertEquals(getMaxAreaForLevel(99), 5_000_000)
})
