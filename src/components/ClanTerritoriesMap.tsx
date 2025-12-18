import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Map } from 'lucide-react';
import type { Coordinate } from '@/types/territory';

interface ClanTerritoriesMapProps {
  clanId: string;
  bannerColor?: string | null;
}

interface ClanTerritory {
  id: string;
  coordinates: Coordinate[];
  user_id: string;
  username: string;
  color: string;
  area: number;
}

const ClanTerritoriesMap = ({ clanId, bannerColor }: ClanTerritoriesMapProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [territories, setTerritories] = useState<ClanTerritory[]>([]);
  const [loading, setLoading] = useState(true);
  const [mapboxToken, setMapboxToken] = useState<string | null>(null);

  // Fetch Mapbox token
  useEffect(() => {
    const fetchToken = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-mapbox-token');
        if (error) throw error;
        setMapboxToken(data?.token || null);
      } catch (e) {
        console.error('Error fetching mapbox token:', e);
      }
    };
    fetchToken();
  }, []);

  // Fetch clan territories
  useEffect(() => {
    const fetchClanTerritories = async () => {
      setLoading(true);
      try {
        // Get clan members
        const { data: members, error: membersError } = await supabase
          .from('clan_members')
          .select('user_id, profiles:profiles!clan_members_user_id_fkey(username, color)')
          .eq('clan_id', clanId);

        if (membersError) throw membersError;

        const memberIds = members?.map((m) => m.user_id) || [];
        if (memberIds.length === 0) {
          setTerritories([]);
          setLoading(false);
          return;
        }

        // Get territories from all clan members
        const { data: territoriesData, error: territoriesError } = await supabase
          .from('territories')
          .select('id, coordinates, user_id, area')
          .in('user_id', memberIds);

        if (territoriesError) throw territoriesError;

        // Map territories with member info
        const mapped: ClanTerritory[] = (territoriesData || []).map((t) => {
          const member = members?.find((m) => m.user_id === t.user_id);
          return {
            id: t.id,
            coordinates: t.coordinates as unknown as Coordinate[],
            user_id: t.user_id,
            username: member?.profiles?.username || 'Miembro',
            color: member?.profiles?.color || bannerColor || '#2563eb',
            area: t.area,
          };
        });

        setTerritories(mapped);
      } catch (e) {
        console.error('Error fetching clan territories:', e);
      } finally {
        setLoading(false);
      }
    };

    if (clanId) {
      fetchClanTerritories();
    }
  }, [clanId, bannerColor]);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || !mapboxToken || territories.length === 0) return;

    mapboxgl.accessToken = mapboxToken;

    // Calculate bounds from all territories
    let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
    territories.forEach((t) => {
      t.coordinates.forEach((coord) => {
        minLng = Math.min(minLng, coord.lng);
        maxLng = Math.max(maxLng, coord.lng);
        minLat = Math.min(minLat, coord.lat);
        maxLat = Math.max(maxLat, coord.lat);
      });
    });

    const centerLng = (minLng + maxLng) / 2;
    const centerLat = (minLat + maxLat) / 2;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [centerLng, centerLat],
      zoom: 13,
    });

    map.current.on('load', () => {
      if (!map.current) return;

      // Add territories as layers
      territories.forEach((territory, index) => {
        const coords = territory.coordinates.map((c) => [c.lng, c.lat]);
        if (coords.length < 3) return;

        // Close polygon if needed
        const firstCoord = coords[0];
        const lastCoord = coords[coords.length - 1];
        if (firstCoord[0] !== lastCoord[0] || firstCoord[1] !== lastCoord[1]) {
          coords.push(firstCoord);
        }

        const sourceId = `territory-${territory.id}`;
        const layerId = `territory-fill-${territory.id}`;
        const outlineId = `territory-outline-${territory.id}`;

        map.current!.addSource(sourceId, {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {
              username: territory.username,
              area: territory.area,
            },
            geometry: {
              type: 'Polygon',
              coordinates: [coords],
            },
          },
        });

        map.current!.addLayer({
          id: layerId,
          type: 'fill',
          source: sourceId,
          paint: {
            'fill-color': territory.color,
            'fill-opacity': 0.4,
          },
        });

        map.current!.addLayer({
          id: outlineId,
          type: 'line',
          source: sourceId,
          paint: {
            'line-color': territory.color,
            'line-width': 2,
            'line-opacity': 0.8,
          },
        });

        // Add popup on click
        map.current!.on('click', layerId, (e) => {
          if (!e.features?.length) return;
          const props = e.features[0].properties;
          new mapboxgl.Popup()
            .setLngLat(e.lngLat)
            .setHTML(`
              <div class="p-2">
                <p class="font-semibold">${props?.username || 'Miembro'}</p>
                <p class="text-sm text-gray-500">${Math.round(props?.area || 0)} m²</p>
              </div>
            `)
            .addTo(map.current!);
        });

        map.current!.on('mouseenter', layerId, () => {
          if (map.current) map.current.getCanvas().style.cursor = 'pointer';
        });

        map.current!.on('mouseleave', layerId, () => {
          if (map.current) map.current.getCanvas().style.cursor = '';
        });
      });

      // Fit bounds to show all territories
      if (minLng !== Infinity) {
        map.current.fitBounds(
          [[minLng - 0.01, minLat - 0.01], [maxLng + 0.01, maxLat + 0.01]],
          { padding: 40, maxZoom: 15 }
        );
      }
    });

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, [mapboxToken, territories]);

  if (loading) {
    return (
      <div className="h-64 rounded-lg bg-card/60 border border-border flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (territories.length === 0) {
    return (
      <div className="h-48 rounded-lg bg-card/60 border border-border flex flex-col items-center justify-center gap-2 text-muted-foreground">
        <Map className="w-8 h-8" />
        <p className="text-sm">Los miembros aún no han conquistado territorios</p>
      </div>
    );
  }

  if (!mapboxToken) {
    return (
      <div className="h-48 rounded-lg bg-card/60 border border-border flex items-center justify-center text-muted-foreground">
        <p className="text-sm">No se pudo cargar el mapa</p>
      </div>
    );
  }

  return (
    <div className="relative">
      <div ref={mapContainer} className="h-64 rounded-lg overflow-hidden border border-border" />
      <div className="absolute bottom-2 left-2 bg-background/80 backdrop-blur-sm px-2 py-1 rounded text-xs text-muted-foreground">
        {territories.length} territorio{territories.length !== 1 ? 's' : ''} del clan
      </div>
    </div>
  );
};

export default ClanTerritoriesMap;
