export interface Coordinate {
  lat: number;
  lng: number;
}

export interface Territory {
  id: string;
  owner: string;
  userId?: string;
  coordinates: Coordinate[];
  area: number; // en m²
  perimeter: number; // en metros
  avgPace: number; // en min/km
  points: number;
  color: string;
  timestamp: number;
  conquered: boolean;
  protectedUntil?: string | null;
  cooldownUntil?: string | null;
  status?: 'idle' | 'protected' | 'contested';
  requiredPace?: number;
  lastAttackerId?: string | null;
  lastAttackAt?: string | null;
  conquestPoints?: number;
  tags?: Array<{ type: string; name: string }>;
  poiSummary?: string | null;
}

export interface Run {
  id: string;
  userId: string;
  path: Coordinate[];
  distance: number;
  duration: number;
  avgPace: number;
  territoriesConquered: number;
  territoriesStolen: number;
  territoriesLost: number;
  pointsGained: number;
  timestamp: number;
}

export interface UserProfile {
  id: string;
  name: string;
  color: string;
  totalPoints: number;
  totalTerritories: number;
  totalDistance: number;
  runs: Run[];
}

export interface MapChallenge {
  id: string;
  name: string;
  description?: string | null;
  latitude: number;
  longitude: number;
  radius: number;
  reward_points: number;
  active: boolean;
  start_date?: string;
  end_date?: string;
}

export interface MapPoi {
  id: string;
  name: string;
  category: 'park' | 'beach' | 'historic' | 'plaza';
  coordinates: Coordinate[];
}
