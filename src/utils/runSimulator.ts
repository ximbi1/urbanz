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
    maxDistance = 2500,
    minPoints = 8,
    maxPoints = 16,
  } = options || {};

  // Random number of points
  const numPoints = Math.floor(Math.random() * (maxPoints - minPoints + 1)) + minPoints;
  
  // Target distance
  const targetDistance = Math.random() * (maxDistance - minDistance) + minDistance;
  
  // Calculate approximate radius based on target perimeter
  // Perimeter ≈ 2 * π * radius, so radius ≈ perimeter / (2 * π)
  const approxRadius = targetDistance / (2 * Math.PI);
  
  // Convert radius to degrees (roughly 111,320m per degree at equator)
  const radiusLat = approxRadius / 111320;
  const radiusLng = approxRadius / (111320 * Math.cos(centerLat * Math.PI / 180));
  
  // Generate points in a rough circle with some randomness
  const path: Coordinate[] = [];
  
  for (let i = 0; i < numPoints; i++) {
    const angle = (2 * Math.PI * i) / numPoints;
    
    // Add randomness to radius (±30%)
    const radiusVariation = 0.7 + Math.random() * 0.6;
    const currentRadiusLat = radiusLat * radiusVariation;
    const currentRadiusLng = radiusLng * radiusVariation;
    
    // Add slight angle offset for more natural shape
    const angleOffset = (Math.random() - 0.5) * 0.3;
    
    const lat = centerLat + currentRadiusLat * Math.sin(angle + angleOffset);
    const lng = centerLng + currentRadiusLng * Math.cos(angle + angleOffset);
    
    path.push({ lat, lng });
  }
  
  // Close the polygon by adding first point at the end
  path.push({ ...path[0] });
  
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
