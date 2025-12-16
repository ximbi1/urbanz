import { assert, assertAlmostEquals, assertEquals } from 'https://deno.land/std@0.190.0/testing/asserts.ts'
import {
  calculateDistance,
  calculatePerimeter,
  calculatePolygonArea,
  findClosedLoops,
  isPolygonClosed,
  computeSafeDifference,
  toPolygonCoords,
} from './geo.ts'

const square: { lat: number; lng: number }[] = [
  { lat: 0, lng: 0 },
  { lat: 0, lng: 0.001 },
  { lat: 0.001, lng: 0.001 },
  { lat: 0.001, lng: 0 },
]

Deno.test('calculateDistance returns expected meters for small delta', () => {
  const meters = calculateDistance({ lat: 0, lng: 0 }, { lat: 0, lng: 0.001 })
  assertAlmostEquals(meters, 111, 1)
})

Deno.test('isPolygonClosed detects closure correctly', () => {
  const openPath = [...square]
  const closedPath = [...square, square[0]]
  assert(!isPolygonClosed(openPath))
  assert(isPolygonClosed(closedPath))
})

Deno.test('calculatePolygonArea and perimeter for a small square', () => {
  const closed = [...square, square[0]]
  const area = calculatePolygonArea(closed)
  const perimeter = calculatePerimeter(closed)

  // 0.001° ≈ 111m at equator, so expected area ≈ 12,000 m² and perimeter ≈ 444 m
  assertAlmostEquals(area, 12300, 500)
  assertAlmostEquals(perimeter, 444, 5)
})

Deno.test('findClosedLoops identifies self-crossing loops', () => {
  const pathWithLoop = [
    ...square,
    square[0],
    { lat: -0.0005, lng: 0 },
    { lat: -0.0005, lng: 0.001 },
  ]

  const loops = findClosedLoops(pathWithLoop)
  assert(loops.length >= 1)
  assert(isPolygonClosed(loops[0]))
})

Deno.test('computeSafeDifference respects minimum area', () => {
  const base = toPolygonCoords([...square, square[0]] as any)
  const basePoly = { type: 'Polygon', coordinates: [base] }
  const smallCut = { type: 'Polygon', coordinates: [[[0,0],[0,0.0001],[0.0001,0.0001],[0,0]]] }
  const result = computeSafeDifference(basePoly as any, smallCut as any, 1000000)
  assertEquals(result, null)
})
