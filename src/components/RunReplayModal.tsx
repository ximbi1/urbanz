import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import { Coordinate } from '@/types/territory';
import { supabase } from '@/integrations/supabase/client';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Pause, Play, RotateCcw, X, Download, Maximize2 } from 'lucide-react';
import 'mapbox-gl/dist/mapbox-gl.css';

interface RunReplayModalProps {
  path: Coordinate[];
  onClose: () => void;
  title?: string;
}

export const RunReplayModal = ({ path, onClose, title }: RunReplayModalProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const runnerMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const pausedProgressRef = useRef(0);
  const playingRef = useRef(true);
  const coordsRef = useRef<[number, number][]>([]);
  const [mapboxToken, setMapboxToken] = useState('');
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const animationDuration = Math.min(Math.max(path.length * 80, 2400), 12000);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const fetchToken = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-mapbox-token');
        if (error) throw error;
        if (data?.token) {
          setMapboxToken(data.token);
        } else {
          setTokenError('No se pudo obtener el token de Mapbox');
        }
      } catch (error) {
        console.error('Error cargando token de Mapbox', error);
        setTokenError('No se pudo cargar el mapa en este momento');
      }
    };
    fetchToken();
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      mapRef.current?.remove();
    };
  }, []);

  useEffect(() => {
    if (!mapboxToken || path.length < 2 || !mapContainer.current) return;

    mapboxgl.accessToken = mapboxToken;
    const bounds = new mapboxgl.LngLatBounds();
    path.forEach(point => bounds.extend([point.lng, point.lat]));
    coordsRef.current = path.map(point => [point.lng, point.lat]);

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/outdoors-v12',
      bounds,
      padding: 50,
      pitch: 45,
      bearing: -20,
    });
    mapRef.current = map;

    map.addControl(new mapboxgl.NavigationControl(), 'top-left');

    map.on('load', () => {
      if (!mapRef.current) return;

      mapRef.current.addSource('mapbox-dem', {
        type: 'raster-dem',
        url: 'mapbox://mapbox.terrain-rgb'
      });

      mapRef.current.setTerrain({ source: 'mapbox-dem', exaggeration: 1.2 });
      mapRef.current.setPitch(50);

      mapRef.current.addSource('replay-route', {
        type: 'geojson',
        data: {
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: [],
          },
          properties: {},
        },
      });

      mapRef.current.addLayer({
        id: 'replay-route',
        type: 'line',
        source: 'replay-route',
        paint: {
          'line-color': '#f97316',
          'line-width': 5,
          'line-opacity': 0.9,
        },
      });

      new mapboxgl.Marker({ color: '#22c55e' })
        .setLngLat(coordsRef.current[0])
        .setPopup(new mapboxgl.Popup().setHTML('<strong>Inicio</strong>'))
        .addTo(mapRef.current);

      runnerMarkerRef.current = new mapboxgl.Marker({ color: '#f97316' })
        .setLngLat(coordsRef.current[0])
        .addTo(mapRef.current);

      startAnimation();
    });
  }, [mapboxToken, path]);

  const updatePathSlice = (endIndex: number) => {
    const source = mapRef.current?.getSource('replay-route') as mapboxgl.GeoJSONSource;
    if (!source) return;
    source.setData({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: coordsRef.current.slice(0, Math.max(2, endIndex + 1)),
      },
      properties: {},
    });
  };

  const animate = (timestamp: number) => {
    if (!playingRef.current) return;
    if (!startTimeRef.current) {
      startTimeRef.current = timestamp - pausedProgressRef.current * animationDuration;
    }
    const elapsed = timestamp - startTimeRef.current;
    const t = Math.min(elapsed / animationDuration, 1);
    setProgress(t);

    const targetIndex = Math.floor(t * (coordsRef.current.length - 1));
    updatePathSlice(targetIndex);
    runnerMarkerRef.current?.setLngLat(coordsRef.current[targetIndex]);

    if (mapRef.current && coordsRef.current[targetIndex]) {
      mapRef.current.easeTo({
        center: coordsRef.current[targetIndex],
        bearing: -20 + (t * 40),
        pitch: 45 + (t * 10),
        duration: 400,
        easing: (n) => n,
      });
    }

    if (t < 1) {
      animationRef.current = requestAnimationFrame(animate);
    } else {
      playingRef.current = false;
      setIsPlaying(false);
    }
  };

  const startAnimation = () => {
    playingRef.current = true;
    setIsPlaying(true);
    startTimeRef.current = null;
    animationRef.current = requestAnimationFrame(animate);
  };

  const handlePause = () => {
    playingRef.current = false;
    setIsPlaying(false);
    pausedProgressRef.current = progress;
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
  };

  const handlePlay = () => {
    if (progress >= 1) {
      restartAnimation();
      return;
    }
    startAnimation();
  };

  const restartAnimation = () => {
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    pausedProgressRef.current = 0;
    setProgress(0);
    runnerMarkerRef.current?.setLngLat(coordsRef.current[0]);
    (mapRef.current?.getSource('replay-route') as mapboxgl.GeoJSONSource)?.setData({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [],
      },
      properties: {},
    });
    startAnimation();
  };

  const handleFullscreenToggle = () => {
    if (!mapContainer.current) return;
    if (!document.fullscreenElement) {
      mapContainer.current.requestFullscreen?.().then(() => setIsFullscreen(true));
    } else {
      document.exitFullscreen?.().then(() => setIsFullscreen(false));
    }
  };

  const captureScreenshot = () => {
    if (!mapRef.current) return;
    const canvas = mapRef.current.getCanvas();
    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = 'replay.png';
    link.click();
  };

  const totalDistanceKm = (path.reduce((acc, curr, idx) => {
    if (idx === 0) return 0;
    const prev = path[idx - 1];
    const R = 6371e3;
    const φ1 = prev.lat * Math.PI/180;
    const φ2 = curr.lat * Math.PI/180;
    const Δφ = (curr.lat - prev.lat) * Math.PI/180;
    const Δλ = (curr.lng - prev.lng) * Math.PI/180;
    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return acc + R * c;
  }, 0) / 1000).toFixed(2);

  const maxElevation = '--';

  useEffect(() => {
    const handler = () => {
      if (document.fullscreenElement !== mapContainer.current) {
        setIsFullscreen(false);
      }
    };
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-fade-in">
      <Card className="w-full max-w-5xl bg-card border-glow p-4 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase text-muted-foreground tracking-widest">Modo espectador</p>
            <h3 className="text-2xl font-display font-bold">{title || 'Replay de carrera'}</h3>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {tokenError ? (
          <div className="text-center text-destructive py-12 text-sm">{tokenError}</div>
        ) : path.length < 2 ? (
          <div className="text-center text-muted-foreground py-12">No hay datos suficientes para mostrar el replay.</div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-[3fr_1fr] gap-4">
              <div ref={mapContainer} className="w-full h-64 md:h-96 rounded-lg border border-border overflow-hidden" />
              <div className="bg-muted/30 rounded-lg p-4 flex flex-col gap-4">
                <div>
                  <p className="text-xs uppercase text-muted-foreground mb-1">Progreso</p>
                  <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-primary to-orange-500 transition-all"
                      style={{ width: `${Math.round(progress * 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>Inicio</span>
                    <span>{Math.round(progress * 100)}%</span>
                    <span>Fin</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <Card className="p-3 bg-background/40 text-center">
                    <p className="text-xs text-muted-foreground">Distancia total</p>
                    <p className="text-xl font-display font-bold">{totalDistanceKm} km</p>
                  </Card>
                  <Card className="p-3 bg-background/40 text-center">
                    <p className="text-xs text-muted-foreground">Altura máx.</p>
                    <p className="text-xl font-display font-bold">{maxElevation}</p>
                  </Card>
                </div>
                <div className="flex flex-col gap-2">
                  <Button variant="secondary" onClick={handleFullscreenToggle} className="w-full">
                    <Maximize2 className="h-4 w-4 mr-2" /> {isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
                  </Button>
                  <Button variant="outline" onClick={captureScreenshot} className="w-full">
                    <Download className="h-4 w-4 mr-2" /> Capturar imagen
                  </Button>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                {isPlaying ? (
                  <Button variant="secondary" onClick={handlePause} className="flex-1">
                    <Pause className="h-4 w-4 mr-2" /> Pausar
                  </Button>
                ) : (
                  <Button variant="secondary" onClick={handlePlay} className="flex-1">
                    <Play className="h-4 w-4 mr-2" /> {progress >= 1 ? 'Reproducir de nuevo' : 'Reanudar'}
                  </Button>
                )}
                <Button variant="outline" onClick={restartAnimation}>
                  <RotateCcw className="h-4 w-4 mr-2" /> Reiniciar
                </Button>
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};
