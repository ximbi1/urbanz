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
  shieldExpires?: string | null;
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
  category: 'park' | 'fountain' | 'district' | 'beach' | 'historic' | 'plaza';
  coordinates: Coordinate[];
}

export interface TerritoryShield {
  id: string;
  territory_id: string;
  user_id: string;
  shield_type: 'consumable' | 'challenge';
  expires_at: string;
}

export interface UserShield {
  id: string;
  user_id: string;
  source: 'consumable' | 'challenge';
  charges: number;
}

export type DuelType = 'distance' | 'territories' | 'points' | 'arena';
export type DuelStatus = 'pending' | 'active' | 'completed';

export interface Duel {
  id: string;
  challenger_id: string;
  opponent_id: string;
  status: DuelStatus;
  duel_type: DuelType;
  target_value: number;
  challenger_progress: number;
  opponent_progress: number;
  start_at: string;
  end_at: string;
  arena_name?: string | null;
  winner_id?: string | null;
}
