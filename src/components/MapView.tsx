import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Coordinate, Territory, MapChallenge, MapPoi } from '@/types/territory';
import { calculatePolygonArea, calculatePerimeter } from '@/utils/geoCalculations';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Locate, Users, User, Globe, X, SlidersHorizontal } from 'lucide-react';
import { usePlayerSettings } from '@/hooks/usePlayerSettings';
import { ContentSkeleton } from './ui/content-skeleton';

interface MapViewProps {
  runPath: Coordinate[];
  onMapClick?: (coord: Coordinate) => void;
  isRunning: boolean;
  currentLocation?: Coordinate | null;
  locationAccuracy?: number | null;
}

const MapView = ({ runPath, onMapClick, isRunning, currentLocation, locationAccuracy }: MapViewProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [mapboxToken, setMapboxToken] = useState<string>('');
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [userLocation, setUserLocation] = useState<Coordinate | null>(null);
  const [friendIds, setFriendIds] = useState<Set<string>>(new Set());
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const userMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const userAccuracyRef = useRef<any>(null);
  const [territoryFilter, setTerritoryFilter] = useState<'all' | 'mine' | 'friends'>('all');
  const [mapChallenges, setMapChallenges] = useState<MapChallenge[]>([]);
  const challengeMarkersRef = useRef<mapboxgl.Marker[]>([]);
  const [mapPois, setMapPois] = useState<MapPoi[]>([]);
  const poiMarkersRef = useRef<mapboxgl.Marker[]>([]);
  const parkMarkersRef = useRef<mapboxgl.Marker[]>([]);
  const [mapReady, setMapReady] = useState(false);
  const [selectedChallenge, setSelectedChallenge] = useState<MapChallenge | null>(null);
  const [challengeTargets, setChallengeTargets] = useState<Set<string>>(new Set());
  const [targetLoading, setTargetLoading] = useState(false);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [showChallenges, setShowChallenges] = useState(true);
  const [showParks, setShowParks] = useState(false);
  const [showFountains, setShowFountains] = useState(false);
  const [showDistricts, setShowDistricts] = useState(false);
  const [districtFeatures, setDistrictFeatures] = useState<any[]>([]);
  const [selectedDistrictId, setSelectedDistrictId] = useState<string | null>(null);
  const [selectedParkId, setSelectedParkId] = useState<string | null>(null);
  const [selectedTerritory, setSelectedTerritory] = useState<any>(null);
  const [parkFeatures, setParkFeatures] = useState<any[]>([]);
  const [parkConquests, setParkConquests] = useState<Map<string, { owner: string; color: string }>>(new Map());
  const selectedDistrict = useMemo(() => {
    if (!selectedDistrictId) return null;
    return districtFeatures.find((feature) => feature.properties?.id === selectedDistrictId) || null;
  }, [districtFeatures, selectedDistrictId]);
  const selectedPark = useMemo(() => {
    if (!selectedParkId) return null;
    return parkFeatures.find((feature) => feature.properties?.id === selectedParkId) || null;
  }, [parkFeatures, selectedParkId]);
  const { user } = useAuth();
  const { settings: playerSettings, loading: settingsLoading } = usePlayerSettings();
  const [explorerRoutes, setExplorerRoutes] = useState<{ id: string; path: Coordinate[]; created_at?: string | null }[]>([]);

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

  const isPolygonContained = (inner: Coordinate[], outer: Coordinate[]) => {
    if (inner.length < 3 || outer.length < 3) return false;
    return inner.every((point) => isPointInPolygon(point, outer));
  };

  const calculateCentroid = useCallback((polygon: Coordinate[]) => {
    if (!polygon.length) {
      return { lat: 0, lng: 0 };
    }
    try {
      const bounds = new mapboxgl.LngLatBounds(
        [polygon[0].lng, polygon[0].lat],
        [polygon[0].lng, polygon[0].lat]
      );
      polygon.forEach((coord) => {
        bounds.extend([coord.lng, coord.lat]);
      });
      const center = bounds.getCenter();
      return { lat: center.lat, lng: center.lng };
    } catch {
      return polygon.reduce(
        (acc, coord) => ({
          lat: acc.lat + coord.lat / polygon.length,
          lng: acc.lng + coord.lng / polygon.length,
        }),
        { lat: 0, lng: 0 }
      );
    }
  }, []);

  const formatPerimeter = (meters: number) => {
    if (!meters || meters <= 0) return 'N/D';
    if (meters >= 1000) return `${(meters / 1000).toFixed(2)} km`;
    return `${Math.round(meters)} m`;
  };

  // Cargar token de Mapbox desde edge function
  useEffect(() => {
    const fetchMapboxToken = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-mapbox-token');
        if (error) throw error;
        if (data?.token) {
          setMapboxToken(data.token);
        }
      } catch (error) {
        console.error('Error cargando token de Mapbox:', error);
        toast.error('Error al cargar el mapa');
      }
    };
    fetchMapboxToken();
  }, []);

  useEffect(() => {
    if (!mapContainer.current || !mapboxToken) return;

    mapboxgl.accessToken = mapboxToken;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [2.1734, 41.3851], // Barcelona
      zoom: 13,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    // Eventos de clic para simular carrera
    map.current.on('click', (e) => {
      if (onMapClick && isRunning) {
        onMapClick({ lat: e.lngLat.lat, lng: e.lngLat.lng });
      }
    });

    map.current.on('load', () => {
      setMapReady(true);
    });

    return () => {
      setMapReady(false);
      markersRef.current.forEach(marker => marker.remove());
      markersRef.current = [];
      challengeMarkersRef.current.forEach(marker => marker.remove());
      challengeMarkersRef.current = [];
      poiMarkersRef.current.forEach(marker => marker.remove());
      poiMarkersRef.current = [];
      parkMarkersRef.current.forEach(marker => marker.remove());
      parkMarkersRef.current = [];
      if (userMarkerRef.current) userMarkerRef.current.remove();
      if (userAccuracyRef.current && map.current?.getSource('user-accuracy')) {
        if (map.current.getLayer('user-accuracy')) {
          map.current.removeLayer('user-accuracy');
        }
        map.current.removeSource('user-accuracy');
      }
      map.current?.remove();
    };
  }, [mapboxToken, isRunning, onMapClick]);

  // Mostrar ubicación del usuario en tiempo real
  useEffect(() => {
    if (!map.current || !map.current.isStyleLoaded() || !currentLocation) return;

    // Crear o actualizar marcador del usuario con animación
    if (!userMarkerRef.current) {
      const el = document.createElement('div');
      el.className = 'user-location-marker';
      el.style.width = '24px';
      el.style.height = '24px';
      el.style.borderRadius = '50%';
      el.style.backgroundColor = '#3b82f6';
      el.style.border = '4px solid white';
      el.style.boxShadow = '0 0 20px rgba(59, 130, 246, 0.8)';
      
      userMarkerRef.current = new mapboxgl.Marker({ element: el })
        .setLngLat([currentLocation.lng, currentLocation.lat])
        .addTo(map.current);
    } else {
      userMarkerRef.current.setLngLat([currentLocation.lng, currentLocation.lat]);
    }

    // Mostrar círculo de precisión
    if (locationAccuracy && locationAccuracy < 50) {
      if (map.current.getLayer('user-accuracy')) {
        map.current.removeLayer('user-accuracy');
      }
      if (map.current.getSource('user-accuracy')) {
        map.current.removeSource('user-accuracy');
      }

      const accuracyRadius = locationAccuracy; // en metros
      const metersToPixelsAtMaxZoom = (meters: number, latitude: number) => {
        return meters / 0.075 / Math.cos(latitude * Math.PI / 180);
      };

      map.current.addSource('user-accuracy', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'Point',
            coordinates: [currentLocation.lng, currentLocation.lat],
          },
        },
      });

      map.current.addLayer({
        id: 'user-accuracy',
        type: 'circle',
        source: 'user-accuracy',
        paint: {
          'circle-radius': {
            stops: [
              [0, 0],
              [20, metersToPixelsAtMaxZoom(accuracyRadius, currentLocation.lat)],
            ],
            base: 2,
          },
          'circle-color': '#3b82f6',
          'circle-opacity': 0.1,
          'circle-stroke-color': '#3b82f6',
          'circle-stroke-width': 1,
          'circle-stroke-opacity': 0.3,
        },
      });
    }
  }, [currentLocation, locationAccuracy]);

  // Cargar territorios desde Supabase con realtime (optimizado con límite)
  useEffect(() => {
    const loadFriends = async () => {
      if (!user) return;

      const { data, error } = await supabase
        .from('friendships')
        .select('friend_id')
        .eq('user_id', user.id)
        .eq('status', 'accepted');

      if (!error && data) {
        setFriendIds(new Set(data.map(f => f.friend_id)));
      }
    };

    loadFriends();
  }, [user]);

  const loadExplorerRoutes = useCallback(async () => {
    if (!user) {
      setExplorerRoutes([]);
      return;
    }
    const { data, error } = await supabase
      .from('explorer_territories')
      .select('id, path, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Error cargando exploraciones:', error);
      setExplorerRoutes([]);
    } else {
      setExplorerRoutes(
        (data || []).map((row: any) => ({
          id: row.id,
          path: row.path as Coordinate[],
          created_at: row.created_at,
        }))
      );
    }
  }, [user]);

  const loadTerritories = useCallback(async () => {
    if (!playerSettings || playerSettings.explorerMode) {
      setTerritories([]);
      return;
    }

    const { data, error } = await supabase
      .from('territories')
      .select(`
        *,
        profiles:user_id (username, color),
        shields:territory_shields(expires_at)
      `)
      .eq('league_shard', playerSettings.leagueShard)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Error cargando territorios:', error);
      return;
    }

    if (data) {
      const formattedTerritories: Territory[] = data.map((t: any) => ({
        id: t.id,
        owner: t.profiles?.username || 'Usuario',
        userId: t.user_id,
        coordinates: t.coordinates as Coordinate[],
        area: t.area,
        perimeter: t.perimeter,
        avgPace: t.avg_pace,
        points: t.points,
        color: t.profiles?.color || '#8b5cf6',
        timestamp: new Date(t.created_at).getTime(),
        conquered: t.conquered,
        protectedUntil: t.protected_until,
        cooldownUntil: t.cooldown_until,
        status: t.status,
        requiredPace: t.required_pace,
        lastAttackerId: t.last_attacker_id,
        lastAttackAt: t.last_attack_at,
        conquestPoints: t.conquest_points,
        tags: t.tags || [],
        poiSummary: t.poi_summary || null,
        shieldExpires: t.shields?.length ? t.shields[0].expires_at : null,
      }));
      setTerritories(formattedTerritories);
    }
  }, [playerSettings]);

  useEffect(() => {
    if (settingsLoading) return;
    if (playerSettings?.explorerMode) {
      loadExplorerRoutes();
      return;
    }

    loadTerritories();

    const filter = playerSettings?.leagueShard ? `league_shard=eq.${playerSettings.leagueShard}` : undefined;

    const channel = supabase
      .channel('territories-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'territories',
          filter,
        },
        async (payload: any) => {
          if (playerSettings?.explorerMode) return;
          // Detectar robo de territorio
          if (payload.old.user_id === user?.id && payload.new.user_id !== user?.id) {
            const { data: thief } = await supabase
              .from('profiles')
              .select('username')
              .eq('id', payload.new.user_id)
              .single();
            
            toast.error('⚠️ ¡Te han robado un territorio!', {
              description: `${thief?.username || 'Alguien'} ha conquistado tu territorio`,
            });
          }
          
          // Efecto visual si robaste un territorio
          if (payload.new.user_id === user?.id && payload.old.user_id !== user?.id && map.current) {
            // Flash de parpadeo en el territorio robado
            setTimeout(() => {
              if (!map.current?.getLayer('territories-fill')) return;
              
              let flashCount = 0;
              const flashInterval = setInterval(() => {
                if (map.current && flashCount < 4) {
                  map.current.setPaintProperty(
                    'territories-fill',
                    'fill-opacity',
                    flashCount % 2 === 0 ? 0.9 : 0.2
                  );
                  flashCount++;
                } else {
                  clearInterval(flashInterval);
                  if (map.current) {
                    map.current.setPaintProperty('territories-fill', 'fill-opacity', 0.4);
                  }
                }
              }, 150);
            }, 500);
          }
          
          loadTerritories();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'territories',
          filter,
        },
        async (payload: any) => {
          if (playerSettings?.explorerMode) return;
          // Efecto visual si el territorio es del usuario actual
          if (payload.new.user_id === user?.id && map.current) {
            const coords = payload.new.coordinates as Coordinate[];
            if (coords && coords.length > 0) {
              // Calcular centro del territorio
              const center = coords.reduce(
                (acc, coord) => ({
                  lat: acc.lat + coord.lat / coords.length,
                  lng: acc.lng + coord.lng / coords.length,
                }),
                { lat: 0, lng: 0 }
              );
              
              // Animación de zoom suave
              const currentZoom = map.current.getZoom();
              map.current.flyTo({
                center: [center.lng, center.lat],
                zoom: Math.max(currentZoom, 16),
                duration: 1000,
              });
            }
          }
          loadTerritories();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'territories',
          filter,
        },
        () => {
          if (playerSettings?.explorerMode) return;
          loadTerritories();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [playerSettings, settingsLoading, loadTerritories, loadExplorerRoutes, user]);

  useEffect(() => {
    if (!map.current) return;
    const handlers = [
      map.current.scrollZoom,
      map.current.boxZoom,
      map.current.dragPan,
      map.current.keyboard,
      map.current.doubleClickZoom,
      map.current.touchZoomRotate,
    ];
    handlers.forEach((handler) => {
      if (!handler) return;
      if (selectedChallenge) {
        handler.disable();
      } else {
        handler.enable();
      }
    });
  }, [selectedChallenge]);

  useEffect(() => {
    const loadChallenges = async () => {
      const { data, error } = await supabase
        .from('map_challenges')
        .select('*')
        .eq('active', true)
        .order('start_date', { ascending: true });
      if (!error && data) {
        setMapChallenges(data as MapChallenge[]);
      }
    };
    loadChallenges();
  }, []);

  useEffect(() => {
    const fetchCategory = async (category: MapPoi['category']) => {
      const chunkSize = 1000;
      let from = 0;
      let done = false;
      const rows: any[] = [];

      while (!done) {
        const { data, error } = await supabase
          .from('map_pois')
          .select('*')
          .eq('category', category)
          .range(from, from + chunkSize - 1);

        if (error) {
          console.error(`Error loading ${category}`, error);
          break;
        }

        if (data && data.length > 0) {
          rows.push(...data);
        }

        if (!data || data.length < chunkSize) {
          done = true;
        } else {
          from += chunkSize;
        }
      }

      return rows;
    };

    const loadPois = async () => {
      const categories: Array<MapPoi['category']> = ['park', 'fountain', 'district'];
      const results = await Promise.all(categories.map(fetchCategory));
      const aggregated = results.flat().map((poi: any) => ({
        ...poi,
        coordinates: (poi.coordinates || []) as Coordinate[],
      }));
      setMapPois(aggregated);
    };

    loadPois();
  }, []);

  useEffect(() => {
    const districts = mapPois
      .filter(poi => poi.category === 'district' && poi.coordinates.length >= 3)
      .map(poi => {
        const area = calculatePolygonArea(poi.coordinates);
        const perimeter = calculatePerimeter(poi.coordinates);
        return {
          type: 'Feature',
          properties: {
            id: poi.id,
            name: poi.name,
            area,
            perimeter,
          },
          geometry: {
            type: 'Polygon' as const,
            coordinates: [poi.coordinates.map(coord => [coord.lng, coord.lat])],
          },
        };
      });
    setDistrictFeatures(districts);
  }, [mapPois]);

  useEffect(() => {
    if (!user) {
      setChallengeTargets(new Set());
      return;
    }
    const fetchTargets = async () => {
      const { data, error } = await supabase
        .from('map_challenge_targets')
        .select('challenge_id')
        .eq('user_id', user.id);
      if (!error && data) {
        setChallengeTargets(new Set(data.map((row: any) => row.challenge_id)));
      }
    };
    fetchTargets();
  }, [user]);

  // Dibujar territorios en el mapa
  useEffect(() => {
    if (!map.current || !map.current.isStyleLoaded()) return;

    // Limpiar layers y sources previos
    if (map.current.getLayer('territories-fill')) {
      map.current.removeLayer('territories-fill');
    }
    if (map.current.getLayer('territories-outline')) {
      map.current.removeLayer('territories-outline');
    }
    if (map.current.getLayer('territories-shield-glow')) {
      map.current.removeLayer('territories-shield-glow');
    }
    if (map.current.getLayer('territories-shield-outline')) {
      map.current.removeLayer('territories-shield-outline');
    }
    if (map.current.getLayer('territories-shield-label')) {
      map.current.removeLayer('territories-shield-label');
    }
    if (map.current.getSource('territories')) {
      map.current.removeSource('territories');
    }

    if (territories.length > 0) {
      // Filtrar territorios según el filtro seleccionado y evitar duplicar polígonos contenidos del mismo usuario
      const filteredTerritories = territories.filter((territory: Territory, index: number) => {
        if (territoryFilter === 'mine' && territory.userId !== user?.id) return false;
        if (territoryFilter === 'friends' && (!territory.userId || !friendIds.has(territory.userId))) return false;

        if (!territory.userId) return true;
        const containsAnother = territories.some((other, otherIndex) => {
          if (index === otherIndex) return false;
          if (other.userId !== territory.userId) return false;
          if (!other.coordinates?.length || !territory.coordinates?.length) return false;
          if ((other.area || 0) < (territory.area || 0)) return false;
          return isPolygonContained(territory.coordinates, other.coordinates);
        });

        if (containsAnother) return false;
        return true;
      });

      const features = filteredTerritories.map((territory: Territory) => {
        const isFriend = territory.userId ? friendIds.has(territory.userId) : false;
        const isOwn = user?.id === territory.userId;
        const protectedUntil = territory.protectedUntil ? new Date(territory.protectedUntil) : null;
        const cooldownUntil = territory.cooldownUntil ? new Date(territory.cooldownUntil) : null;
        const shieldUntil = territory.shieldExpires ? new Date(territory.shieldExpires) : null;
        const now = new Date();
        const protectionRemaining = protectedUntil && protectedUntil > now
          ? Math.max(0, protectedUntil.getTime() - now.getTime())
          : null;
        const cooldownRemaining = cooldownUntil && cooldownUntil > now
          ? Math.max(0, cooldownUntil.getTime() - now.getTime())
          : null;
        const shieldRemaining = shieldUntil && shieldUntil > now
          ? Math.max(0, shieldUntil.getTime() - now.getTime())
          : null;
        const shieldLabel = shieldRemaining
          ? `Escudo ${formatDuration(shieldRemaining)}`
          : null;
        const status = shieldRemaining ? 'protected' : (territory.status || 'idle');

        return {
          type: 'Feature' as const,
          properties: {
            color: territory.color,
            owner: territory.owner,
            area: Math.round(territory.area),
            perimeter: territory.perimeter || calculatePerimeter(territory.coordinates),
            id: territory.id,
            avgPace: territory.avgPace.toFixed(2),
            timestamp: new Date(territory.timestamp).toLocaleDateString('es-ES', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            }),
            isFriend: isFriend && !isOwn,
            isOwn,
            status,
            protectedLabel: protectionRemaining
              ? `Protegido ${formatDuration(protectionRemaining)}`
              : null,
            cooldownLabel: cooldownRemaining
              ? `Cooldown ${formatDuration(cooldownRemaining)}`
              : null,
            poiSummary: territory.poiSummary || null,
            hasShield: Boolean(shieldRemaining),
            shieldLabel,
            poiTags: territory.tags || [],
          },
          geometry: {
            type: 'Polygon' as const,
            coordinates: [
              territory.coordinates.map(coord => [coord.lng, coord.lat]),
            ],
          },
        };
      });

      map.current.addSource('territories', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features,
        },
      });

      map.current.addLayer({
        id: 'territories-fill',
        type: 'fill',
        source: 'territories',
        paint: {
          'fill-color': ['get', 'color'],
          'fill-opacity': 0.4,
        },
      });

      map.current.addLayer({
        id: 'territories-outline',
        type: 'line',
        source: 'territories',
        paint: {
          'line-color': ['get', 'color'],
          'line-width': [
            'case',
            ['get', 'isOwn'], 4,
            ['get', 'isFriend'], 3,
            2
          ],
          'line-dasharray': [
            'case',
            ['get', 'isFriend'], ['literal', [2, 2]],
            ['literal', [1]]
          ],
        },
      });

      map.current.addLayer({
        id: 'territories-shield-glow',
        type: 'line',
        source: 'territories',
        filter: ['==', ['get', 'hasShield'], true],
        paint: {
          'line-color': '#facc15',
          'line-width': 8,
          'line-opacity': 0.35,
          'line-blur': 2,
        },
      });

      map.current.addLayer({
        id: 'territories-shield-outline',
        type: 'line',
        source: 'territories',
        filter: ['==', ['get', 'hasShield'], true],
        paint: {
          'line-color': '#facc15',
          'line-width': 3,
        },
      });

      map.current.addLayer({
        id: 'territories-shield-label',
        type: 'symbol',
        source: 'territories',
        filter: ['==', ['get', 'hasShield'], true],
        layout: {
          'text-field': ['get', 'shieldLabel'],
          'text-size': 12,
          'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
          'text-offset': [0, 1.2],
        },
        paint: {
          'text-color': '#facc15',
          'text-halo-color': '#0f172a',
          'text-halo-width': 1.5,
        },
      });

      // Selección para mostrar panel detallado
      const popupHandler = (e: mapboxgl.MapMouseEvent) => {
        if (!e.features || !e.features[0]) return;
        const props: any = e.features[0].properties;
        const normalizeTags = (raw: any): string[] => {
          if (!raw) return [];
          let arr: any = raw;
          if (typeof raw === 'string') {
            try {
              arr = JSON.parse(raw);
            } catch {
              arr = [raw];
            }
          }
          if (!Array.isArray(arr)) arr = [arr];
          return arr.map((t: any) => {
            if (typeof t === 'string') return t;
            if (t && typeof t === 'object') return t.name || t.type || JSON.stringify(t);
            return String(t);
          });
        };
        const parsedPoiTags = normalizeTags(props.poiTags);
        const safePoiSummary = typeof props.poiSummary === 'string' ? props.poiSummary : (props.poiSummary ? JSON.stringify(props.poiSummary) : null);
        setSelectedTerritory({
          owner: props.owner,
          area: Number(props.area) || 0,
          perimeter: Number(props.perimeter) || 0,
          avgPace: props.avgPace,
          timestamp: props.timestamp,
          status: props.status,
          protectedLabel: props.protectedLabel || null,
          cooldownLabel: props.cooldownLabel || null,
          shieldLabel: props.shieldLabel || null,
          poiSummary: safePoiSummary,
          poiTags: parsedPoiTags,
          color: props.color,
        });
      };

      map.current.on('click', 'territories-fill', popupHandler);

      return () => {
        if (map.current) {
          map.current.off('click', 'territories-fill', popupHandler);
        }
      };
    }
  }, [territories, friendIds, user, territoryFilter]);

  useEffect(() => {
    if (!map.current || !map.current.isStyleLoaded()) return;

    if (map.current.getLayer('explorer-routes-line')) {
      map.current.removeLayer('explorer-routes-line');
    }
    if (map.current.getSource('explorer-routes')) {
      map.current.removeSource('explorer-routes');
    }

    if (!playerSettings?.explorerMode || explorerRoutes.length === 0) return;

    const geojson = {
      type: 'FeatureCollection',
      features: explorerRoutes.map(route => ({
        type: 'Feature',
        properties: { id: route.id },
        geometry: {
          type: 'LineString',
          coordinates: route.path.map(point => [point.lng, point.lat]),
        },
      })),
    } as any;

    map.current.addSource('explorer-routes', {
      type: 'geojson',
      data: geojson,
    });

    map.current.addLayer({
      id: 'explorer-routes-line',
      type: 'line',
      source: 'explorer-routes',
      paint: {
        'line-color': '#38bdf8',
        'line-width': 3,
        'line-opacity': 0.8,
      },
    });
  }, [explorerRoutes, playerSettings?.explorerMode]);

  // Renderizar parques como polígonos y marcadores cuando se habilita el filtro
  useEffect(() => {
    if (!map.current || !map.current.isStyleLoaded()) return;

    // Limpiar marcadores de parques existentes
    parkMarkersRef.current.forEach(marker => marker.remove());
    parkMarkersRef.current = [];

    if (map.current.getLayer('parks-highlight')) map.current.removeLayer('parks-highlight');
    if (map.current.getLayer('parks-outline')) map.current.removeLayer('parks-outline');
    if (map.current.getSource('parks')) map.current.removeSource('parks');

    if (!showParks) {
      setSelectedParkId(null);
      setParkFeatures([]);
      setParkConquests(new Map());
      return;
    }

    // Cargar conquistas de parques
    const loadParkConquests = async () => {
      const { data } = await supabase
        .from('park_conquests')
        .select('park_id, profiles:user_id(username, color)');
      
      const conquests = new Map<string, { owner: string; color: string }>();
      if (data) {
        data.forEach((conquest: any) => {
          conquests.set(conquest.park_id, {
            owner: conquest.profiles?.username || 'Usuario',
            color: conquest.profiles?.color || '#22c55e'
          });
        });
      }
      setParkConquests(conquests);
      return conquests;
    };

    loadParkConquests().then((conquests) => {
      if (!map.current) return;

      const features = mapPois
        .filter(poi => poi.category === 'park' && poi.coordinates?.length)
        .map(poi => {
          const perimeter = calculatePerimeter(poi.coordinates);
          const area = calculatePolygonArea(poi.coordinates);
          const conquest = conquests.get(poi.id);

          return {
            type: 'Feature' as const,
            properties: { 
              id: poi.id, 
              name: poi.name, 
              perimeter, 
              area,
              owner: conquest?.owner || null,
              ownerColor: conquest?.color || null
            },
            geometry: {
              type: 'Polygon' as const,
              coordinates: [poi.coordinates.map(c => [c.lng, c.lat])],
            },
          };
        });

      setParkFeatures(features);

      if (!features.length) return;

      map.current.addSource('parks', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: features,
        },
      });

      // Solo contorno, sin relleno verde (usa color del propietario si existe)
      map.current.addLayer({
        id: 'parks-outline',
        type: 'line',
        source: 'parks',
        paint: {
          'line-color': '#22c55e',
          'line-width': 2,
          'line-opacity': 0.8,
        },
      });

      // Capa de highlight cuando se selecciona
      map.current.addLayer({
        id: 'parks-highlight',
        type: 'fill',
        source: 'parks',
        filter: ['==', ['get', 'id'], ''],
        paint: {
          'fill-color': 'rgba(34, 197, 94, 0.25)',
          'fill-outline-color': 'rgba(34, 197, 94, 0.4)',
        },
      });

      // Crear marcadores de iconos para cada parque
      features.forEach(feature => {
        const coords = feature.geometry.coordinates[0];
        const bounds = new mapboxgl.LngLatBounds(
          [coords[0][0], coords[0][1]],
          [coords[0][0], coords[0][1]]
        );
        coords.forEach((c: number[]) => bounds.extend([c[0], c[1]]));
        const center = bounds.getCenter();

        const el = document.createElement('div');
        el.style.width = '28px';
        el.style.height = '28px';
        el.style.borderRadius = '999px';
        el.style.display = 'flex';
        el.style.alignItems = 'center';
        el.style.justifyContent = 'center';
        // Usar color del propietario si existe
        el.style.background = feature.properties.ownerColor 
          ? `${feature.properties.ownerColor}dd` 
          : 'rgba(34,197,94,0.85)';
        el.style.color = '#fff';
        el.style.fontSize = '16px';
        el.style.boxShadow = '0 3px 10px rgba(0,0,0,0.3)';
        el.style.cursor = 'pointer';
        el.innerHTML = '🌳';

        el.addEventListener('click', (event) => {
          event.stopPropagation();
          setSelectedParkId((prev) => (prev === feature.properties.id ? null : feature.properties.id));
        });

        const marker = new mapboxgl.Marker({ element: el })
          .setLngLat([center.lng, center.lat])
          .addTo(map.current!);

        parkMarkersRef.current.push(marker);
      });

      const handleParkClick = (e: mapboxgl.MapLayerMouseEvent) => {
        const feature = e.features && e.features[0];
        if (!feature) return;
        const id = feature.properties?.id as string | undefined;
        if (!id) return;
        setSelectedParkId((prev) => (prev === id ? null : id));
      };

      map.current.on('click', 'parks-outline', handleParkClick);
      map.current.on('click', 'parks-highlight', handleParkClick);
    });
  }, [showParks, mapPois]);

  useEffect(() => {
    if (!mapReady || !map.current || !map.current.isStyleLoaded()) return;
    challengeMarkersRef.current.forEach(marker => marker.remove());
    challengeMarkersRef.current = [];
    if (!showChallenges) return;
    challengeMarkersRef.current.forEach(marker => marker.remove());
    challengeMarkersRef.current = [];

    mapChallenges.forEach(challenge => {
      const el = document.createElement('div');
      el.style.width = '32px';
      el.style.height = '32px';
      el.style.borderRadius = '999px';
      el.style.background = 'linear-gradient(135deg, #f97316, #facc15)';
      el.style.display = 'flex';
      el.style.alignItems = 'center';
      el.style.justifyContent = 'center';
      el.style.color = '#fff';
      el.style.fontWeight = '700';
      el.style.boxShadow = '0 4px 12px rgba(0,0,0,0.25)';
      el.innerHTML = '⚑';

      const popupHtml = `
        <div style="min-width: 180px;">
          <p style="font-weight: 600; margin-bottom: 4px;">${challenge.name}</p>
          <p style="font-size: 12px; color: #94a3b8; margin-bottom: 6px;">${challenge.description || ''}</p>
          <p style="font-size: 12px; color: #f97316;">+${challenge.reward_points} pts</p>
        </div>
      `;

      el.addEventListener('click', (event) => {
        event.stopPropagation();
        setSelectedChallenge(challenge);
      });

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([challenge.longitude, challenge.latitude])
        .setPopup(new mapboxgl.Popup().setHTML(popupHtml))
        .addTo(map.current!);

      challengeMarkersRef.current.push(marker);
    });
  }, [mapChallenges, mapReady, showChallenges]);

  // Renderizar marcadores de POIs (fountains y districts solamente)
  // Los parques se muestran como polígonos, no como marcadores
  useEffect(() => {
    if (!mapReady || !map.current || !map.current.isStyleLoaded()) return;
    poiMarkersRef.current.forEach(marker => marker.remove());
    poiMarkersRef.current = [];
    
    // Solo procesar fuentes y distritos con marcadores
    // Los parques usan polígonos (outline) en lugar de marcadores
    if (!showFountains && !showDistricts) return;
    
    const iconMap: Record<string, string> = {
      fountain: '🚰',
      district: '🗺️',
    };
    
    mapPois.forEach(poi => {
      // Los parques NO se muestran como marcadores - usan polígonos
      if (poi.category === 'park') return;
      // Solo mostrar fuentes si el filtro está activado
      if (poi.category === 'fountain' && !showFountains) return;
      // Solo mostrar distritos si el filtro está activado
      if (poi.category === 'district' && !showDistricts) return;
      // Saltar categorías desconocidas
      if (!['fountain', 'district'].includes(poi.category)) return;

      const el = document.createElement('div');
      el.style.width = '28px';
      el.style.height = '28px';
      el.style.borderRadius = '999px';
      el.style.display = 'flex';
      el.style.alignItems = 'center';
      el.style.justifyContent = 'center';
      el.style.background = 'rgba(15,15,25,0.8)';
      el.style.color = '#fff';
      el.style.fontSize = '16px';
      el.style.boxShadow = '0 3px 10px rgba(0,0,0,0.3)';
      el.innerHTML = iconMap[poi.category] || '⭐';

      const centroid = calculateCentroid(poi.coordinates);

      if (poi.category === 'district') {
        el.style.background = 'rgba(59,130,246,0.85)';
        el.addEventListener('click', (event) => {
          event.stopPropagation();
          setSelectedDistrictId((prev) => (prev === poi.id ? null : poi.id));
        });
      }

      // Los parques se manejan como polígonos, no marcadores

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([centroid.lng, centroid.lat])
        .addTo(map.current!);

      if (poi.category === 'fountain') {
        const popupHtml = `
          <div style="min-width: 180px;color:#0f172a;">
            <p style="font-weight:600;margin-bottom:4px;">${poi.name}</p>
            <p style="font-size:12px;color:#475569;margin-bottom:6px;">Punto de agua potable</p>
            <p style="font-size:12px;">Ideal para recargar agua durante la ruta.</p>
          </div>
        `;
        marker.setPopup(new mapboxgl.Popup().setHTML(popupHtml));
      }

      poiMarkersRef.current.push(marker);
    });
  }, [mapPois, mapReady, showFountains, showDistricts]);

  useEffect(() => {
    if (!showDistricts) {
      setSelectedDistrictId(null);
    }
  }, [showDistricts]);

  useEffect(() => {
    if (!mapReady || !map.current || !map.current.isStyleLoaded()) return;

    if (map.current.getLayer('districts-outline')) {
      map.current.removeLayer('districts-outline');
    }
    if (map.current.getLayer('districts-highlight')) {
      map.current.removeLayer('districts-highlight');
    }
    if (map.current.getSource('districts')) {
      map.current.removeSource('districts');
    }

    if (!showDistricts || districtFeatures.length === 0) {
      setSelectedDistrictId(null);
      return;
    }

    map.current.addSource('districts', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: districtFeatures,
      },
    });

    map.current.addLayer({
      id: 'districts-outline',
      type: 'line',
      source: 'districts',
      paint: {
        'line-color': 'rgba(147, 197, 253, 0.8)',
        'line-width': 2,
      },
    });

    map.current.addLayer({
      id: 'districts-highlight',
      type: 'fill',
      source: 'districts',
      filter: ['==', ['get', 'id'], ''],
      paint: {
        'fill-color': 'rgba(59, 130, 246, 0.25)',
        'fill-outline-color': 'rgba(59, 130, 246, 0.4)',
      },
    });

    const handleClick = (e: mapboxgl.MapLayerMouseEvent) => {
      const feature = e.features && e.features[0];
      if (!feature) return;
      const id = feature.properties?.id as string | undefined;
      if (!id) return;
      setSelectedDistrictId((prev) => (prev === id ? null : id));
    };

    const handleMapClick = (e: mapboxgl.MapLayerMouseEvent) => {
      const features = map.current?.queryRenderedFeatures(e.point, {
        layers: ['districts-outline', 'districts-highlight'],
      });
      if (!features || features.length === 0) {
        setSelectedDistrictId(null);
      }
    };

    map.current.on('click', 'districts-outline', handleClick);
    map.current.on('click', 'districts-highlight', handleClick);
    map.current.on('click', handleMapClick);

    return () => {
      if (map.current) {
        map.current.off('click', 'districts-outline', handleClick);
        map.current.off('click', 'districts-highlight', handleClick);
        map.current.off('click', handleMapClick);
        if (map.current.getLayer('districts-outline')) map.current.removeLayer('districts-outline');
        if (map.current.getLayer('districts-highlight')) map.current.removeLayer('districts-highlight');
        if (map.current.getSource('districts')) map.current.removeSource('districts');
      }
    };
  }, [mapReady, showDistricts, districtFeatures]);

  useEffect(() => {
    if (!map.current || !map.current.isStyleLoaded()) return;
    if (!map.current.getLayer('districts-highlight')) return;
    if (!showDistricts || !selectedDistrictId) {
      map.current.setFilter('districts-highlight', ['==', ['get', 'id'], '']);
    } else {
      map.current.setFilter('districts-highlight', ['==', ['get', 'id'], selectedDistrictId]);
    }
  }, [selectedDistrictId, showDistricts]);

  // Update parks highlight filter when selectedParkId changes
  useEffect(() => {
    if (!map.current || !map.current.isStyleLoaded()) return;
    if (!map.current.getLayer('parks-highlight')) return;
    if (!showParks || !selectedParkId) {
      map.current.setFilter('parks-highlight', ['==', ['get', 'id'], '']);
    } else {
      map.current.setFilter('parks-highlight', ['==', ['get', 'id'], selectedParkId]);
    }
  }, [selectedParkId, showParks]);

  const formatDuration = (milliseconds: number) => {
    const totalMinutes = Math.floor(milliseconds / (60 * 1000));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours > 0) {
      return `${hours}h ${minutes}m restantes`;
    }
    return `${minutes}m restantes`;
  };

  const formatDistance = (meters: number) => {
    if (!meters) return '0 km';
    if (meters >= 1000) return `${(meters / 1000).toFixed(2)} km`;
    return `${meters.toFixed(0)} m`;
  };

  const formatAreaValue = (metersSquared: number) => {
    if (!metersSquared) return '0 km²';
    return `${(metersSquared / 1_000_000).toFixed(2)} km²`;
  };

  const toggleChallengeTarget = async (challenge: MapChallenge) => {
    if (!user) {
      toast.error('Inicia sesión para guardar objetivos');
      return;
    }
    setTargetLoading(true);
    try {
      if (challengeTargets.has(challenge.id)) {
        const { error } = await supabase
          .from('map_challenge_targets')
          .delete()
          .eq('challenge_id', challenge.id)
          .eq('user_id', user.id);
        if (error) throw error;
        const updated = new Set(challengeTargets);
        updated.delete(challenge.id);
        setChallengeTargets(updated);
        toast.info('Objetivo eliminado');
      } else {
        const { error } = await supabase
          .from('map_challenge_targets')
          .insert({ challenge_id: challenge.id, user_id: user.id });
        if (error) throw error;
        const updated = new Set(challengeTargets);
        updated.add(challenge.id);
        setChallengeTargets(updated);
        toast.success('Objetivo guardado');
      }
    } catch (error) {
      console.error('Error actualizando objetivo:', error);
      toast.error('No se pudo actualizar el objetivo');
    } finally {
      setTargetLoading(false);
    }
  };

  // Dibujar ruta actual
  useEffect(() => {
    if (!map.current || !map.current.isStyleLoaded()) return;

    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    if (runPath.length === 0) return;

    // Dibujar línea de ruta con efecto de rastro brillante
    if (map.current.getLayer('run-path-glow')) {
      map.current.removeLayer('run-path-glow');
    }
    if (map.current.getLayer('run-path')) {
      map.current.removeLayer('run-path');
    }
    if (map.current.getSource('run-path')) {
      map.current.removeSource('run-path');
    }

    map.current.addSource('run-path', {
      type: 'geojson',
      data: {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: runPath.map(coord => [coord.lng, coord.lat]),
        },
      },
    });

    // Capa de brillo/glow debajo del rastro principal
    map.current.addLayer({
      id: 'run-path-glow',
      type: 'line',
      source: 'run-path',
      paint: {
        'line-color': '#a855f7',
        'line-width': 12,
        'line-opacity': 0.3,
        'line-blur': 4,
      },
    });

    // Rastro principal con gradiente
    map.current.addLayer({
      id: 'run-path',
      type: 'line',
      source: 'run-path',
      paint: {
        'line-color': '#a855f7',
        'line-width': 5,
        'line-opacity': 0.9,
      },
    });

    // Marcadores de inicio y fin
    const startMarker = new mapboxgl.Marker({ color: '#22c55e' })
      .setLngLat([runPath[0].lng, runPath[0].lat])
      .addTo(map.current);
    markersRef.current.push(startMarker);

    if (runPath.length > 1) {
      const endMarker = new mapboxgl.Marker({ color: '#ef4444' })
        .setLngLat([runPath[runPath.length - 1].lng, runPath[runPath.length - 1].lat])
        .addTo(map.current);
      markersRef.current.push(endMarker);
    }
  }, [runPath]);

  const centerOnUser = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setUserLocation(location);
          map.current?.flyTo({
            center: [location.lng, location.lat],
            zoom: 16,
            duration: 1500,
          });
          toast.success('Centrado en tu ubicación');
        },
        (error) => {
          toast.error('No se pudo obtener tu ubicación');
        }
      );
    } else {
      toast.error('Geolocalización no disponible');
    }
  };

  if (!mapboxToken) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-background p-4">
        <ContentSkeleton type="map" />
      </div>
    );
  }

  const overlayActive = Boolean(selectedChallenge);

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="absolute inset-0" />
      
      {/* Indicación de modo */}
      {playerSettings?.explorerMode && (
        <div className="absolute top-4 left-4 z-30 text-left">
          <Card className="px-4 py-2 bg-sky-500/10 text-sky-200 border border-sky-500/40 shadow-lg">
            <p className="text-xs uppercase tracking-widest">Modo Explorador</p>
            <p className="text-sm">Guardando recuerdos personales</p>
          </Card>
        </div>
      )}

      {/* Filtros */}
      {!playerSettings?.explorerMode && (
        <div
          className={`absolute top-4 left-4 z-20 flex flex-col gap-2 transition-opacity duration-200 ${overlayActive ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
        >
        <Button
          variant="secondary"
          size="sm"
          className="shadow-lg"
          onClick={() => setShowFilterPanel((prev) => !prev)}
        >
          <SlidersHorizontal className="w-4 h-4 mr-2" />
          {showFilterPanel ? 'Ocultar filtros' : 'Filtros'}
        </Button>
        {showFilterPanel && (
          <Card className="w-64 p-3 space-y-3 border-glow bg-background/95">
            <div>
              <p className="text-xs uppercase text-muted-foreground mb-2">Territorios</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => setTerritoryFilter('all')}
                  variant={territoryFilter === 'all' ? 'default' : 'outline'}
                  size="sm"
                >
                  <Globe className="w-4 h-4 mr-1" /> Todos
                </Button>
                <Button
                  onClick={() => setTerritoryFilter('mine')}
                  variant={territoryFilter === 'mine' ? 'default' : 'outline'}
                  size="sm"
                >
                  <User className="w-4 h-4 mr-1" /> Míos
                </Button>
                <Button
                  onClick={() => setTerritoryFilter('friends')}
                  variant={territoryFilter === 'friends' ? 'default' : 'outline'}
                  size="sm"
                >
                  <Users className="w-4 h-4 mr-1" /> Amigos
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">Pines de retos</span>
                <Switch checked={showChallenges} onCheckedChange={setShowChallenges} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Parques</span>
                <Switch checked={showParks} onCheckedChange={setShowParks} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Fuentes</span>
                <Switch checked={showFountains} onCheckedChange={setShowFountains} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Barrios</span>
                <Switch checked={showDistricts} onCheckedChange={setShowDistricts} />
              </div>
            </div>
          </Card>
        )}
        </div>
      )}
      
      {/* Botón de centrar ubicación */}
      <Button
        onClick={centerOnUser}
        className={`absolute bottom-24 right-4 z-10 rounded-full shadow-lg transition-opacity duration-200 ${overlayActive ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
        size="icon"
      >
        <Locate className="w-5 h-5" />
      </Button>

      {selectedChallenge && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-background/80 backdrop-blur">
          <Card className="w-full max-w-md bg-card border-glow p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase text-muted-foreground">Reto del mapa</p>
                <h3 className="text-xl font-display font-bold">{selectedChallenge.name}</h3>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setSelectedChallenge(null)}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              {selectedChallenge.description || 'Corre alrededor de este pin para reclamar la recompensa.'}
            </p>
            <div className="bg-muted/30 rounded-lg p-3 text-sm space-y-2">
              <div className="flex items-center justify-between">
                <span>Radio</span>
                <strong>{selectedChallenge.radius} m</strong>
              </div>
              <div className="flex items-center justify-between">
                <span>Recompensa</span>
                <strong className="text-primary">+{selectedChallenge.reward_points} pts</strong>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Ventana</span>
                <span>
                  {selectedChallenge.start_date?.slice(0, 10)} – {selectedChallenge.end_date?.slice(0, 10)}
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                className="flex-1"
                disabled={targetLoading}
                onClick={() => toggleChallengeTarget(selectedChallenge)}
              >
                {challengeTargets.has(selectedChallenge.id)
                  ? 'Quitar de objetivos'
                  : 'Marcar como objetivo'}
              </Button>
              <Button variant="secondary" onClick={() => setSelectedChallenge(null)}>
                Cerrar
              </Button>
            </div>
          </Card>
        </div>
      )}

      {showDistricts && selectedDistrict && (
        <div className="absolute bottom-4 left-4 z-[80] max-w-sm animate-fade-in">
          <Card className="p-4 bg-background/95 border-glow">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase text-muted-foreground">Distrito seleccionado</p>
                <h4 className="text-lg font-display font-semibold">{selectedDistrict.properties?.name}</h4>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setSelectedDistrictId(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Área aproximada</span>
                <span className="font-semibold">
                  {formatAreaValue(selectedDistrict.properties?.area || 0)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Perímetro</span>
                <span className="font-semibold">{formatDistance(selectedDistrict.properties?.perimeter || 0)}</span>
              </div>
            </div>
            <div className="mt-4 text-xs text-muted-foreground">
              Rodea todo el contorno resaltado para reclamar el distrito completo. Usa escudos si quieres mantenerlo protegido.
            </div>
          </Card>
        </div>
      )}

      {showParks && selectedPark && (
        <div className="absolute bottom-4 left-4 z-[80] max-w-sm animate-fade-in">
          <Card className="p-4 bg-background/95 shadow-elevated">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase text-muted-foreground">Parque seleccionado</p>
                <h4 className="text-lg font-display font-semibold text-green-500">{selectedPark.properties?.name}</h4>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setSelectedParkId(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Área aproximada</span>
                <span className="font-semibold">
                  {formatAreaValue(selectedPark.properties?.area || 0)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Perímetro</span>
                <span className="font-semibold">{formatDistance(selectedPark.properties?.perimeter || 0)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Propietario</span>
                {selectedPark.properties?.owner ? (
                  <span className="font-semibold" style={{ color: selectedPark.properties.ownerColor || '#22c55e' }}>
                    {selectedPark.properties.owner}
                  </span>
                ) : (
                  <span className="font-semibold text-muted-foreground">Sin conquistar</span>
                )}
              </div>
            </div>
            <div className="mt-4 text-xs text-muted-foreground">
              Rodea todo el perímetro del parque para conquistarlo. Los territorios dentro de este parque se etiquetarán automáticamente.
            </div>
          </Card>
        </div>
      )}

      {selectedTerritory && (
        <div className="fixed inset-0 z-[85] flex items-end justify-center px-4 pb-6 bg-black/50 backdrop-blur-sm">
          <Card className="w-full max-w-lg bg-card/95 border-glow p-4 animate-in slide-in-from-bottom duration-200">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <p className="text-xs uppercase text-muted-foreground">Territorio</p>
                <h3 className="text-xl font-display font-bold" style={{ color: selectedTerritory.color || 'hsl(var(--primary))' }}>
                  {selectedTerritory.owner || 'Desconocido'}
                </h3>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setSelectedTerritory(null)}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground text-xs">Área</p>
                <p className="font-semibold">{selectedTerritory.area?.toLocaleString('es-ES')} m²</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Perímetro</p>
                <p className="font-semibold">{formatPerimeter(selectedTerritory.perimeter || 0)}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Ritmo medio</p>
                <p className="font-semibold">{selectedTerritory.avgPace} min/km</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Conquistado</p>
                <p className="font-semibold">{selectedTerritory.timestamp}</p>
              </div>
            </div>
            <div className="mt-3 space-y-1 text-xs text-muted-foreground">
              {[selectedTerritory.shieldLabel, selectedTerritory.protectedLabel, selectedTerritory.cooldownLabel]
                .filter(Boolean)
                .map((label: string) => (
                  <div key={label}>{label}</div>
                ))}
            </div>
            {selectedTerritory.poiSummary && (
              <div className="mt-3 text-sm text-amber-500">
                {selectedTerritory.poiSummary}
              </div>
            )}
            {selectedTerritory.poiTags?.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                {selectedTerritory.poiTags.map((tag: string, idx: number) => (
                  <span key={`${tag}-${idx}`} className="px-2 py-1 rounded-full bg-muted/60 text-muted-foreground">{tag}</span>
                ))}
              </div>
            )}
            <div className="mt-4 flex justify-end">
              <Button onClick={() => setSelectedTerritory(null)}>Volver al mapa</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default MapView;
