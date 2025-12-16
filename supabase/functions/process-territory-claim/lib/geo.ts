import { polygon, area as turfArea, intersect, difference, buffer, union } from 'https://esm.sh/@turf/turf@6.5.0'
import { Coordinate } from './types.ts'

const EARTH_RADIUS = 6371000

export const calculateDistance = (point1: Coordinate, point2: Coordinate): number => {
  const phi1 = (point1.lat * Math.PI) / 180
  const phi2 = (point2.lat * Math.PI) / 180
  const deltaPhi = ((point2.lat - point1.lat) * Math.PI) / 180
  const deltaLambda = ((point2.lng - point1.lng) * Math.PI) / 180

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return EARTH_RADIUS * c
}

export const calculatePathDistance = (path: Coordinate[]): number => {
  let total = 0
  for (let i = 1; i < path.length; i++) {
    total += calculateDistance(path[i - 1], path[i])
  }
  return total
}

export const isPolygonClosed = (path: Coordinate[], threshold = 50): boolean => {
  if (path.length < 3) return false
  const distance = calculateDistance(path[0], path[path.length - 1])
  return distance <= threshold
}

export const findClosedLoops = (path: Coordinate[], threshold = 30): Coordinate[][] => {
  const loops: Coordinate[][] = []
  if (path.length < 4) return loops

  for (let i = 0; i < path.length - 3; i++) {
    for (let j = i + 3; j < path.length; j++) {
      const dist = calculateDistance(path[i], path[j])
      if (dist <= threshold) {
        const loopPath = path.slice(i, j + 1)
        if (loopPath.length >= 4) {
          loopPath.push({ ...loopPath[0] })
          loops.push(loopPath)
        }
        break
      }
    }
  }

  return loops
}

export const toPolygonCoords = (path: Coordinate[]) => {
  const coords = path.map((point) => [point.lng, point.lat])
  const first = coords[0]
  const last = coords[coords.length - 1]
  if (first && last && (first[0] !== last[0] || first[1] !== last[1])) {
    coords.push([...first])
  }
  return coords
}

export const mergeLoopsIntoPolygon = (mainPath: Coordinate[], loops: Coordinate[][]): Coordinate[] => {
  if (loops.length === 0) return mainPath

  try {
    const mainCoords = toPolygonCoords(mainPath)
    let mergedPolygon = polygon([mainCoords])

    for (const loop of loops) {
      try {
        const loopCoords = toPolygonCoords(loop)
        const loopPolygon = polygon([loopCoords])
        const unified = union(mergedPolygon, loopPolygon)
        if (unified && unified.geometry.type === 'Polygon') {
          mergedPolygon = unified as any
        }
      } catch (e) {
        console.warn('Error uniendo loop:', e)
      }
    }

    const resultCoords = mergedPolygon.geometry.coordinates[0]
    return resultCoords.map((coord: number[]) => ({ lng: coord[0], lat: coord[1] }))
  } catch (e) {
    console.warn('Error en mergeLoopsIntoPolygon:', e)
    return mainPath
  }
}

export const calculatePolygonArea = (coordinates: Coordinate[]): number => {
  if (coordinates.length < 3) return 0
  let area = 0
  for (let i = 0; i < coordinates.length; i++) {
    const j = (i + 1) % coordinates.length
    const lat1 = (coordinates[i].lat * Math.PI) / 180
    const lat2 = (coordinates[j].lat * Math.PI) / 180
    const lng1 = (coordinates[i].lng * Math.PI) / 180
    const lng2 = (coordinates[j].lng * Math.PI) / 180
    area += (lng2 - lng1) * (2 + Math.sin(lat1) + Math.sin(lat2))
  }
  area = (area * EARTH_RADIUS * EARTH_RADIUS) / 2
  return Math.abs(area)
}

export const calculatePerimeter = (coordinates: Coordinate[]): number => {
  if (coordinates.length < 2) return 0
  let perimeter = 0
  for (let i = 0; i < coordinates.length; i++) {
    const j = (i + 1) % coordinates.length
    perimeter += calculateDistance(coordinates[i], coordinates[j])
  }
  return perimeter
}

export const calculateAveragePace = (distance: number, duration: number): number => {
  if (distance === 0) return 0
  const distanceKm = distance / 1000
  const durationMin = duration / 60
  return durationMin / distanceKm
}

export const toLatLngCoordsFromGeo = (feature: any): Coordinate[] => {
  if (!feature?.geometry) return []
  const { type, coordinates } = feature.geometry

  const extractRing = (ring: number[][]): Coordinate[] => ring.map(([lng, lat]) => ({ lat, lng }))

  if (type === 'Polygon') {
    const ring = coordinates[0] || []
    return extractRing(ring)
  }

  if (type === 'MultiPolygon') {
    let best: Coordinate[] = []
    let bestArea = 0
    for (const poly of coordinates) {
      const ring = poly[0] || []
      const asCoords = extractRing(ring)
      if (asCoords.length >= 3) {
        const polyFeature = polygon([ring])
        const a = turfArea(polyFeature)
        if (a > bestArea) {
          bestArea = a
          best = asCoords
        }
      }
    }
    return best
  }

  return []
}

export const ensureClosed = (coords: Coordinate[]): Coordinate[] => {
  if (!coords.length) return coords
  const first = coords[0]
  const last = coords[coords.length - 1]
  if (first.lat !== last.lat || first.lng !== last.lng) {
    return [...coords, { ...first }]
  }
  return coords
}

export const computeSafeDifference = (baseGeom: any, cutGeom: any, minimumArea: number): Coordinate[] | null => {
  try {
    let diff = difference(baseGeom, cutGeom)
    if (!diff) {
      diff = difference(buffer(baseGeom, 0), buffer(cutGeom, 0))
    }
    if (!diff) return null

    const coords = toLatLngCoordsFromGeo(diff)
    const closed = ensureClosed(coords)
    if (closed.length < 4) return null
    const a = turfArea(diff)
    if (a < minimumArea) return null
    return closed
  } catch (e) {
    console.warn('Error computing difference:', e)
    return null
  }
}
