import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { Coordinate } from '@/types/territory';
import { calculatePerimeter } from '@/utils/geoCalculations';
import { Search, Filter, MapPin } from 'lucide-react';

interface ZonesProps {
  onClose: () => void;
  onNavigateToZone?: (coordinates: Coordinate) => void;
  isMobileFullPage?: boolean;
}

interface PoiItem {
  id: string;
  name: string;
  category: 'park' | 'district';
  coordinates: Coordinate[];
}

interface TerritoryItem {
  id: string;
  owner: string;
  coordinates: Coordinate[];
}

interface ParkConquest {
  park_id: string;
  user_id: string;
  owner_name: string;
}

const isPointInPolygon = (point: Coordinate, polygon: Coordinate[]) => {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng;
    const yi = polygon[i].lat;
    const xj = polygon[j].lng;
    const yj = polygon[j].lat;

    const intersect = ((yi > point.lat) !== (yj > point.lat)) &&
      (point.lng < ((xj - xi) * (point.lat - yi)) / Math.max(yj - yi, 1e-9) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
};

const getCentroid = (polygon: Coordinate[]): Coordinate => {
  if (!polygon.length) return { lat: 0, lng: 0 };
  let lat = 0;
  let lng = 0;
  polygon.forEach((p) => {
    lat += p.lat;
    lng += p.lng;
  });
  return { lat: lat / polygon.length, lng: lng / polygon.length };
};

const formatPerimeter = (meters: number) => {
  if (!meters || meters <= 0) return 'N/D';
  if (meters >= 1000) return `${(meters / 1000).toFixed(2)} km`;
  return `${Math.round(meters)} m`;
};

const formatDistance = (meters: number | null) => {
  if (meters == null) return null;
  if (meters >= 1000) return `${(meters / 1000).toFixed(2)} km`;
  return `${Math.round(meters)} m`;
};

type OwnerFilter = 'all' | 'free' | 'owned';

const Zones = ({ onClose, onNavigateToZone, isMobileFullPage = false }: ZonesProps) => {
  const [pois, setPois] = useState<PoiItem[]>([]);
  const [territories, setTerritories] = useState<TerritoryItem[]>([]);
  const [parkConquests, setParkConquests] = useState<ParkConquest[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'parks' | 'districts'>('parks');
  const [userLocation, setUserLocation] = useState<Coordinate | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [ownerFilter, setOwnerFilter] = useState<OwnerFilter>('all');

  useEffect(() => {
    const fetchPois = async () => {
      const categories: Array<PoiItem['category']> = ['park', 'district'];
      const chunkSize = 1000;
      const rows: any[] = [];
      for (const category of categories) {
        let from = 0;
        let done = false;
        while (!done) {
          const { data, error } = await supabase
            .from('map_pois')
            .select('*')
            .eq('category', category)
            .range(from, from + chunkSize - 1);
          if (error) break;
          if (data?.length) rows.push(...data.map((p: any) => ({
            id: p.id,
            name: p.name,
            category: p.category,
            coordinates: p.coordinates || [],
          })));
          if (!data || data.length < chunkSize) done = true; else from += chunkSize;
        }
      }
      setPois(rows as PoiItem[]);
    };

    const fetchTerritories = async () => {
      const { data, error } = await supabase
        .from('territories')
        .select('id, coordinates, owner:profiles!territories_user_id_fkey(username)')
        .limit(500);
      if (!error && data) {
        setTerritories(data.map((t: any) => ({
          id: t.id,
          owner: t.owner?.username || 'Desconocido',
          coordinates: t.coordinates || [],
        })));
      }
    };

    const fetchParkConquests = async () => {
      const { data, error } = await supabase
        .from('park_conquests')
        .select('park_id, user_id, owner:profiles!park_conquests_user_id_fkey(username)');
      if (!error && data) {
        setParkConquests(data.map((pc: any) => ({
          park_id: pc.park_id,
          user_id: pc.user_id,
          owner_name: pc.owner?.username || 'Desconocido',
        })));
      }
    };

    Promise.all([fetchPois(), fetchTerritories(), fetchParkConquests()]).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!('geolocation' in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => {},
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, []);

  const distanceBetween = (a: Coordinate, b: Coordinate) => {
    const R = 6371000;
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  };

  const rows = useMemo(() => {
    const isParksTab = tab === 'parks';
    
    return pois
      .filter(p => isParksTab ? p.category === 'park' : p.category === 'district')
      .map(poi => {
        const centroid = getCentroid(poi.coordinates);
        
        // For parks, check park_conquests table first
        let owner: string | null = null;
        if (isParksTab) {
          const conquest = parkConquests.find(pc => pc.park_id === poi.id);
          if (conquest) {
            owner = conquest.owner_name;
          }
        } else {
          // For districts, use territory overlap logic
          owner = territories.find(t => isPointInPolygon(centroid, t.coordinates))?.owner || null;
        }
        
        const perimeter = calculatePerimeter(poi.coordinates);
        const distance = userLocation ? distanceBetween(userLocation, centroid) : null;
        return {
          ...poi,
          owner,
          perimeter,
          distance,
          centroid,
        };
      })
      // Apply search filter
      .filter(row => {
        if (!searchQuery.trim()) return true;
        return row.name.toLowerCase().includes(searchQuery.toLowerCase());
      })
      // Apply owner filter
      .filter(row => {
        if (ownerFilter === 'all') return true;
        if (ownerFilter === 'free') return !row.owner;
        if (ownerFilter === 'owned') return !!row.owner;
        return true;
      })
      // Sort by distance (closest first)
      .sort((a, b) => {
        if (a.distance == null && b.distance == null) return 0;
        if (a.distance == null) return 1;
        if (b.distance == null) return -1;
        return a.distance - b.distance;
      });
  }, [pois, tab, territories, parkConquests, userLocation, searchQuery, ownerFilter]);

  const handleNavigateToZone = (centroid: Coordinate) => {
    if (onNavigateToZone) {
      onNavigateToZone(centroid);
    }
    onClose();
  };

  const freeCount = rows.filter(r => !r.owner).length;
  const ownedCount = rows.filter(r => r.owner).length;

  return (
    <div className={`w-full ${isMobileFullPage ? 'min-h-screen bg-background' : ''} px-4 py-4 space-y-3`}>
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-display font-bold glow-primary">Zonas</h2>
        <Button variant="ghost" onClick={onClose}>Cerrar</Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <Button variant={tab === 'parks' ? 'default' : 'secondary'} onClick={() => setTab('parks')}>
          Parques
        </Button>
        <Button variant={tab === 'districts' ? 'default' : 'secondary'} onClick={() => setTab('districts')}>
          Barrios
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={`Buscar ${tab === 'parks' ? 'parque' : 'barrio'}...`}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Filter buttons */}
      <div className="flex gap-2 flex-wrap">
        <Button
          size="sm"
          variant={ownerFilter === 'all' ? 'default' : 'outline'}
          onClick={() => setOwnerFilter('all')}
          className="text-xs"
        >
          <Filter className="h-3 w-3 mr-1" />
          Todos ({rows.length + (ownerFilter !== 'all' ? (ownerFilter === 'free' ? ownedCount : freeCount) : 0)})
        </Button>
        <Button
          size="sm"
          variant={ownerFilter === 'free' ? 'default' : 'outline'}
          onClick={() => setOwnerFilter('free')}
          className="text-xs text-emerald-400 border-emerald-500/50 hover:bg-emerald-500/10"
        >
          Libres ({ownerFilter === 'all' ? freeCount : ownerFilter === 'free' ? rows.length : freeCount})
        </Button>
        <Button
          size="sm"
          variant={ownerFilter === 'owned' ? 'default' : 'outline'}
          onClick={() => setOwnerFilter('owned')}
          className="text-xs text-amber-400 border-amber-500/50 hover:bg-amber-500/10"
        >
          Ocupados ({ownerFilter === 'all' ? ownedCount : ownerFilter === 'owned' ? rows.length : ownedCount})
        </Button>
      </div>

      {loading ? (
        <div className="text-muted-foreground text-sm">Cargando zonas...</div>
      ) : rows.length === 0 ? (
        <div className="text-muted-foreground text-sm py-8 text-center">
          No se encontraron {tab === 'parks' ? 'parques' : 'barrios'} con los filtros seleccionados.
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <Card key={row.id} className="p-3 bg-muted/30 border-border hover:bg-muted/50 transition-colors">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{row.name}</p>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                    <span>Perímetro: {formatPerimeter(row.perimeter)}</span>
                    {row.distance != null && (
                      <span className="text-primary">A {formatDistance(row.distance)}</span>
                    )}
                  </div>
                </div>
                <div className={`text-xs font-medium px-2 py-1 rounded-full whitespace-nowrap ${
                  row.owner 
                    ? 'bg-amber-500/20 text-amber-400' 
                    : 'bg-emerald-500/20 text-emerald-400'
                }`}>
                  {row.owner ? row.owner : 'Libre'}
                </div>
              </div>
              <div className="mt-2 flex justify-end">
                <Button 
                  size="sm" 
                  variant="secondary" 
                  onClick={() => handleNavigateToZone(row.centroid)}
                  className="gap-1"
                >
                  <MapPin className="h-3 w-3" />
                  Ver en mapa
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default Zones;
