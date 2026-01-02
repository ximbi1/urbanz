import { Coordinate } from '@/types/territory';
import { calculatePathDistance, calculatePolygonArea } from '@/utils/geoCalculations';

// Developer IDs that can use simulation
export const DEV_USER_IDS = [
  'a3f2544e-bc3d-4491-869a-ec20f83ad259',
];

export const isDevUser = (userId: string | undefined): boolean => {
  return userId ? DEV_USER_IDS.includes(userId) : false;
};

interface SimulatedRun {
  path: Coordinate[];
  distance: number;
  duration: number;
  area: number;
}

// Generate a random closed polygon around a center point
export const generateSimulatedRun = (
  centerLat: number = 40.4168, // Madrid default
  centerLng: number = -3.7038,
  options?: {
    minDistance?: number; // meters
    maxDistance?: number;
    minPoints?: number;
    maxPoints?: number;
  }
): SimulatedRun => {
  const {
    minDistance = 800,
    maxDistance = 2000,
    minPoints = 12,
    maxPoints = 24,
  } = options || {};

  // Target distance
  const targetDistance = Math.random() * (maxDistance - minDistance) + minDistance;
  
  // Calculate approximate radius based on target perimeter
  // Perimeter ≈ 2 * π * radius, so radius ≈ perimeter / (2 * π)
  const approxRadius = targetDistance / (2 * Math.PI);
  
  // Convert radius to degrees (roughly 111,320m per degree at equator)
  const radiusLat = approxRadius / 111320;
  const radiusLng = approxRadius / (111320 * Math.cos(centerLat * Math.PI / 180));
  
  // Calculate how many points we need so that distance between points is < 80m
  // Perimeter / numPoints should be < 80m
  const minPointsForValidation = Math.ceil(targetDistance / 70); // ~70m between points max
  const numPoints = Math.max(minPointsForValidation, Math.floor(Math.random() * (maxPoints - minPoints + 1)) + minPoints);
  
  // Generate base polygon points
  const basePoints: Coordinate[] = [];
  
  for (let i = 0; i < numPoints; i++) {
    const angle = (2 * Math.PI * i) / numPoints;
    
    // Add randomness to radius (±20% - less variation for smoother path)
    const radiusVariation = 0.85 + Math.random() * 0.3;
    const currentRadiusLat = radiusLat * radiusVariation;
    const currentRadiusLng = radiusLng * radiusVariation;
    
    const lat = centerLat + currentRadiusLat * Math.sin(angle);
    const lng = centerLng + currentRadiusLng * Math.cos(angle);
    
    basePoints.push({ lat, lng });
  }
  
  // Close the polygon by adding first point at the end
  basePoints.push({ ...basePoints[0] });
  
  // Now interpolate to ensure no jump > 80m
  const path: Coordinate[] = [];
  const MAX_SEGMENT_DISTANCE = 70; // meters
  
  for (let i = 0; i < basePoints.length - 1; i++) {
    const p1 = basePoints[i];
    const p2 = basePoints[i + 1];
    
    path.push(p1);
    
    // Calculate distance between points
    const segmentDist = calculatePathDistance([p1, p2]);
    
    if (segmentDist > MAX_SEGMENT_DISTANCE) {
      // Need to add intermediate points
      const numIntermediatePoints = Math.ceil(segmentDist / MAX_SEGMENT_DISTANCE);
      
      for (let j = 1; j < numIntermediatePoints; j++) {
        const ratio = j / numIntermediatePoints;
        path.push({
          lat: p1.lat + (p2.lat - p1.lat) * ratio,
          lng: p1.lng + (p2.lng - p1.lng) * ratio,
        });
      }
    }
  }
  
  // Add final point (closing)
  path.push({ ...basePoints[0] });
  
  // Calculate actual metrics
  const distance = calculatePathDistance(path);
  const area = calculatePolygonArea(path);
  
  // Calculate realistic duration based on pace (5-7 min/km)
  const paceMinPerKm = 5 + Math.random() * 2;
  const distanceKm = distance / 1000;
  const durationMinutes = distanceKm * paceMinPerKm;
  const duration = Math.round(durationMinutes * 60);
  
  return {
    path,
    distance,
    duration,
    area,
  };
};
