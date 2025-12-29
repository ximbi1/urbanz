import { useState, useRef, useEffect } from 'react';
import { X, Share2, Download, Copy, Check, Loader2 } from 'lucide-react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Run, Coordinate } from '@/types/territory';
import { toast } from 'sonner';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { supabase } from '@/integrations/supabase/client';
import { calculateDistance } from '@/utils/geoCalculations';
import logoUrbanz from '@/assets/logo-urbanz.png';

interface ShareConquestProps {
  run: Run;
  onClose: () => void;
}

export const ShareConquest = ({ run, onClose }: ShareConquestProps) => {
  const [generating, setGenerating] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [mapboxToken, setMapboxToken] = useState<string>('');
  const hiddenMapContainer = useRef<HTMLDivElement>(null);
  const runPath = (run.path as Coordinate[]) || [];

  useEffect(() => {
    fetchMapboxToken();
  }, []);

  const fetchMapboxToken = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('get-mapbox-token');
      if (error) throw error;
      setMapboxToken(data.token);
    } catch (error) {
      console.error('Error fetching Mapbox token:', error);
    }
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${minutes}:${String(secs).padStart(2, '0')}`;
  };

  const formatDate = () => {
    return new Date(run.timestamp).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const generateShareText = () => {
    const totalTerritories = run.territoriesConquered + run.territoriesStolen;
    let text = `🏃‍♂️ ¡Nueva carrera en Urbanz!\n\n`;
    text += `📍 ${(run.distance / 1000).toFixed(2)} km\n`;
    text += `⏱️ ${formatDuration(run.duration)}\n`;
    text += `⚡ ${run.avgPace.toFixed(2)} min/km\n`;
    
    if (totalTerritories > 0) {
      text += `\n🗺️ ${totalTerritories} territorios conquistados`;
      if (run.territoriesStolen > 0) {
        text += ` (${run.territoriesStolen} robados! 🔥)`;
      }
    }
    
    text += `\n🏆 +${run.pointsGained} puntos\n\n`;
    text += `#Urbanz #Running #TerritoryConquest`;
    
    return text;
  };

  const calculateSplits = () => {
    if (runPath.length < 2) return [];
    const splits: { km: number; coord: Coordinate }[] = [];
    let accumDist = 0;
    let kmCounter = 1;
    
    for (let i = 1; i < runPath.length; i++) {
      const segDist = calculateDistance(runPath[i - 1], runPath[i]);
      accumDist += segDist;
      
      while (accumDist >= kmCounter * 1000 && run.distance > 0) {
        splits.push({ km: kmCounter, coord: runPath[i] });
        kmCounter++;
      }
    }
    return splits;
  };

  const captureMapImage = (): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!hiddenMapContainer.current || !mapboxToken || runPath.length < 2) {
        reject(new Error('No map data available'));
        return;
      }

      mapboxgl.accessToken = mapboxToken;

      // Calculate center and bounds
      const centerLat = runPath.reduce((sum, p) => sum + p.lat, 0) / runPath.length;
      const centerLng = runPath.reduce((sum, p) => sum + p.lng, 0) / runPath.length;

      const tempMap = new mapboxgl.Map({
        container: hiddenMapContainer.current,
        style: 'mapbox://styles/mapbox/dark-v11',
        center: [centerLng, centerLat],
        zoom: 13,
        preserveDrawingBuffer: true,
        interactive: false,
      });

      tempMap.on('load', () => {
        // Add route
        tempMap.addSource('route', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: runPath.map(p => [p.lng, p.lat]),
            },
          },
        });

        tempMap.addLayer({
          id: 'route-glow',
          type: 'line',
          source: 'route',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': '#8b5cf6', 'line-width': 8, 'line-opacity': 0.4 },
        });

        tempMap.addLayer({
          id: 'route',
          type: 'line',
          source: 'route',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': '#a78bfa', 'line-width': 4 },
        });

        // Fit bounds
        const bounds = new mapboxgl.LngLatBounds();
        runPath.forEach(p => bounds.extend([p.lng, p.lat]));
        tempMap.fitBounds(bounds, { padding: 60, duration: 0 });

        // Wait for tiles to load
        const waitForIdle = () => {
          if (tempMap.areTilesLoaded()) {
            setTimeout(() => {
              try {
                const canvas = tempMap.getCanvas();
                const dataUrl = canvas.toDataURL('image/png');
                tempMap.remove();
                resolve(dataUrl);
              } catch (error) {
                tempMap.remove();
                reject(error);
              }
            }, 500);
          } else {
            setTimeout(waitForIdle, 100);
          }
        };

        setTimeout(waitForIdle, 1000);
      });

      tempMap.on('error', (e) => {
        tempMap.remove();
        reject(e);
      });
    });
  };

  const generateImage = async () => {
    setGenerating(true);
    try {
      // Capture map
      let mapImageUrl: string | null = null;
      try {
        mapImageUrl = await captureMapImage();
      } catch (e) {
        console.warn('Could not capture map:', e);
      }

      // Create final canvas
      const canvas = document.createElement('canvas');
      const width = 1080;
      const height = 1350;
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) throw new Error('No se pudo crear el canvas');

      // Dark background
      ctx.fillStyle = '#0f0f14';
      ctx.fillRect(0, 0, width, height);

      // Header gradient
      const headerGradient = ctx.createLinearGradient(0, 0, width, 0);
      headerGradient.addColorStop(0, '#8b5cf6');
      headerGradient.addColorStop(1, '#6366f1');
      ctx.fillStyle = headerGradient;
      ctx.fillRect(0, 0, width, 120);

      // Load and draw logo
      const logoImg = new Image();
      await new Promise<void>((resolve) => {
        logoImg.onload = () => resolve();
        logoImg.onerror = () => resolve();
        logoImg.src = logoUrbanz;
      });
      
      if (logoImg.complete && logoImg.naturalWidth > 0) {
        ctx.drawImage(logoImg, 20, 15, 90, 90);
      }

      // URBANZ title
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 48px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('URBANZ', 125, 78);

      // Date
      ctx.font = '28px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fillText(formatDate(), width - 40, 78);

      // Map section
      const mapY = 140;
      const mapHeight = 650;
      
      if (mapImageUrl) {
        const mapImg = new Image();
        await new Promise<void>((resolve, reject) => {
          mapImg.onload = () => resolve();
          mapImg.onerror = () => reject();
          mapImg.src = mapImageUrl!;
        });
        
        // Draw map with rounded corners effect
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(30, mapY, width - 60, mapHeight, 20);
        ctx.clip();
        ctx.drawImage(mapImg, 30, mapY, width - 60, mapHeight);
        ctx.restore();
        
        // Map border
        ctx.strokeStyle = 'rgba(139, 92, 246, 0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(30, mapY, width - 60, mapHeight, 20);
        ctx.stroke();

        // Draw markers on canvas
        const splits = calculateSplits();
        const mapBounds = {
          minLng: Math.min(...runPath.map(p => p.lng)),
          maxLng: Math.max(...runPath.map(p => p.lng)),
          minLat: Math.min(...runPath.map(p => p.lat)),
          maxLat: Math.max(...runPath.map(p => p.lat)),
        };
        
        const coordToCanvas = (coord: Coordinate) => {
          const padding = 60;
          const mapWidth = width - 60 - padding * 2;
          const mapH = mapHeight - padding * 2;
          const x = 30 + padding + ((coord.lng - mapBounds.minLng) / (mapBounds.maxLng - mapBounds.minLng || 1)) * mapWidth;
          const y = mapY + padding + ((mapBounds.maxLat - coord.lat) / (mapBounds.maxLat - mapBounds.minLat || 1)) * mapH;
          return { x, y };
        };

        // Start marker
        const startPos = coordToCanvas(runPath[0]);
        ctx.beginPath();
        ctx.arc(startPos.x, startPos.y, 16, 0, Math.PI * 2);
        ctx.fillStyle = '#22c55e';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.stroke();

        // End marker
        const endPos = coordToCanvas(runPath[runPath.length - 1]);
        ctx.beginPath();
        ctx.arc(endPos.x, endPos.y, 16, 0, Math.PI * 2);
        ctx.fillStyle = '#ef4444';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.stroke();

        // Km markers
        ctx.font = 'bold 18px system-ui';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        splits.forEach(split => {
          const pos = coordToCanvas(split.coord);
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, 14, 0, Math.PI * 2);
          ctx.fillStyle = '#f59e0b';
          ctx.fill();
          ctx.fillStyle = '#000000';
          ctx.fillText(String(split.km), pos.x, pos.y);
        });
      } else {
        // Fallback gradient if no map
        const gradientMap = ctx.createLinearGradient(30, mapY, 30, mapY + mapHeight);
        gradientMap.addColorStop(0, '#1a1a2e');
        gradientMap.addColorStop(1, '#16162a');
        ctx.fillStyle = gradientMap;
        ctx.beginPath();
        ctx.roundRect(30, mapY, width - 60, mapHeight, 20);
        ctx.fill();
        
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.font = '32px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('🗺️ Ruta no disponible', width / 2, mapY + mapHeight / 2);
      }

      // Stats section
      const statsY = mapY + mapHeight + 40;
      const cardWidth = (width - 90) / 2;
      const cardHeight = 160;
      const cardGap = 30;

      const drawStatCard = (x: number, y: number, icon: string, value: string, label: string, color: string) => {
        // Card background
        ctx.fillStyle = 'rgba(30, 30, 40, 0.9)';
        ctx.beginPath();
        ctx.roundRect(x, y, cardWidth, cardHeight, 16);
        ctx.fill();
        
        // Border
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(x, y, cardWidth, cardHeight, 16);
        ctx.stroke();

        // Icon
        ctx.font = '40px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText(icon, x + cardWidth / 2, y + 50);

        // Value
        ctx.font = 'bold 42px system-ui';
        ctx.fillStyle = color;
        ctx.fillText(value, x + cardWidth / 2, y + 100);

        // Label
        ctx.font = '20px system-ui';
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.fillText(label, x + cardWidth / 2, y + 135);
      };

      // Distance
      drawStatCard(30, statsY, '📍', `${(run.distance / 1000).toFixed(2)}`, 'kilómetros', '#a78bfa');
      
      // Duration
      drawStatCard(30 + cardWidth + cardGap, statsY, '⏱️', formatDuration(run.duration), 'duración', '#60a5fa');
      
      // Pace
      drawStatCard(30, statsY + cardHeight + 20, '⚡', `${run.avgPace.toFixed(2)}`, 'min/km', '#34d399');
      
      // Points
      drawStatCard(30 + cardWidth + cardGap, statsY + cardHeight + 20, '🏆', `+${run.pointsGained}`, 'puntos', '#fbbf24');

      // Footer
      ctx.fillStyle = 'rgba(139, 92, 246, 0.3)';
      ctx.fillRect(0, height - 60, width, 60);
      
      ctx.font = '24px system-ui';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fillText('#Urbanz  •  Conquista tu ciudad corriendo', width / 2, height - 22);

      // Convert to image
      const dataUrl = canvas.toDataURL('image/png');
      setImageUrl(dataUrl);
      toast.success('Imagen generada');
    } catch (error) {
      toast.error('Error al generar imagen');
      console.error(error);
    } finally {
      setGenerating(false);
    }
  };

  const downloadImage = () => {
    if (!imageUrl) return;
    
    const link = document.createElement('a');
    link.download = `urbanz-conquest-${Date.now()}.png`;
    link.href = imageUrl;
    link.click();
    toast.success('Imagen descargada');
  };

  const copyText = async () => {
    const text = generateShareText();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('Texto copiado al portapapeles');
    } catch (error) {
      toast.error('Error al copiar texto');
    }
  };

  const shareNative = async () => {
    const text = generateShareText();
    
    if (navigator.share) {
      try {
        if (imageUrl) {
          const response = await fetch(imageUrl);
          const blob = await response.blob();
          const file = new File([blob], 'urbanz-conquest.png', { type: 'image/png' });
          
          await navigator.share({
            text,
            files: [file],
          });
        } else {
          await navigator.share({ text });
        }
        toast.success('Compartido exitosamente');
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          toast.error('Error al compartir');
        }
      }
    } else {
      copyText();
    }
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      {/* Hidden map container for capturing */}
      <div 
        ref={hiddenMapContainer} 
        className="absolute -left-[9999px] top-0"
        style={{ width: 800, height: 600 }}
      />

      <Card className="w-full max-w-2xl bg-card border-glow p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-display font-bold glow-primary">
            Compartir Conquista
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Imagen generada o botón para generar */}
        {imageUrl ? (
          <div className="space-y-3">
            <img 
              src={imageUrl} 
              alt="Conquista compartida" 
              className="w-full rounded-lg border border-border"
            />
            <div className="flex gap-2">
              <Button onClick={downloadImage} className="flex-1">
                <Download className="h-4 w-4 mr-2" />
                Descargar
              </Button>
              <Button onClick={shareNative} className="flex-1" variant="outline">
                <Share2 className="h-4 w-4 mr-2" />
                Compartir
              </Button>
            </div>
          </div>
        ) : (
          <Button 
            onClick={generateImage} 
            disabled={generating || !mapboxToken}
            className="w-full h-48 flex flex-col gap-3"
            variant="outline"
          >
            {generating ? (
              <>
                <Loader2 className="h-8 w-8 animate-spin" />
                <span>Generando imagen con mapa...</span>
              </>
            ) : (
              <>
                <div className="text-4xl">🗺️</div>
                <span>Generar Imagen para Compartir</span>
                <span className="text-xs text-muted-foreground">
                  Incluye mapa, ruta y estadísticas
                </span>
              </>
            )}
          </Button>
        )}

        {/* Preview del texto */}
        <Card className="p-4 bg-muted/30 border-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">Texto para redes</span>
            <Button onClick={copyText} variant="ghost" size="sm">
              {copied ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
          <pre className="whitespace-pre-wrap text-sm font-mono text-muted-foreground">
            {generateShareText()}
          </pre>
        </Card>

        <p className="text-xs text-muted-foreground text-center">
          Comparte tu conquista en redes sociales para inspirar a otros corredores
        </p>
      </Card>
    </div>
  );
};
