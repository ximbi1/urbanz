import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Coordinate } from '@/types/territory';
import { calculatePerimeter } from '@/utils/geoCalculations';

interface ZonesProps {
  onClose: () => void;
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

const Zones = ({ onClose, isMobileFullPage = false }: ZonesProps) => {
  const [pois, setPois] = useState<PoiItem[]>([]);
  const [territories, setTerritories] = useState<TerritoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'parks' | 'districts'>('parks');
  const [userLocation, setUserLocation] = useState<Coordinate | null>(null);

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

    Promise.all([fetchPois(), fetchTerritories()]).finally(() => setLoading(false));
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
    return pois
      .filter(p => tab === 'parks' ? p.category === 'park' : p.category === 'district')
      .map(poi => {
        const centroid = getCentroid(poi.coordinates);
        const owner = territories.find(t => isPointInPolygon(centroid, t.coordinates))?.owner || null;
        const perimeter = calculatePerimeter(poi.coordinates);
        const distance = userLocation ? distanceBetween(userLocation, centroid) : null;
        return {
          ...poi,
          owner,
          perimeter,
          distance,
        };
      })
      .sort((a, b) => {
        if (a.distance == null && b.distance == null) return 0;
        if (a.distance == null) return 1;
        if (b.distance == null) return -1;
        return a.distance - b.distance;
      });
  }, [pois, tab, territories, userLocation]);

  return (
    <div className={`w-full ${isMobileFullPage ? 'min-h-screen bg-background' : ''} px-4 py-4 space-y-3`}>
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-display font-bold glow-primary">Zonas</h2>
        <Button variant="ghost" onClick={onClose}>Cerrar</Button>
      </div>

      <div className="flex gap-2">
        <Button variant={tab === 'parks' ? 'default' : 'secondary'} onClick={() => setTab('parks')}>
          Parques
        </Button>
        <Button variant={tab === 'districts' ? 'default' : 'secondary'} onClick={() => setTab('districts')}>
          Barrios
        </Button>
      </div>

      {loading ? (
        <div className="text-muted-foreground text-sm">Cargando zonas...</div>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <Card key={row.id} className="p-3 bg-muted/30 border-border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">{row.name}</p>
                  <p className="text-xs text-muted-foreground">Perímetro: {formatPerimeter(row.perimeter)}</p>
                  {row.distance != null && (
                    <p className="text-xs text-muted-foreground">A {row.distance >= 1000 ? (row.distance / 1000).toFixed(2) + ' km' : Math.round(row.distance) + ' m'}</p>
                  )}
                </div>
                <div className="text-sm font-semibold">
                  {row.owner ? `Pertenece a ${row.owner}` : 'Disponible'}
                </div>
              </div>
              <div className="mt-2 text-right">
                <Button size="sm" variant="secondary" onClick={onClose}>
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
