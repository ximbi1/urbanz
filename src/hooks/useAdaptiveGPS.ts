import { useCallback, useRef } from 'react';
import { Coordinate } from '@/types/territory';
import { calculatePathDistance } from '@/utils/geoCalculations';

interface GPSConfig {
  minDistanceMeters: number;       // Distancia mínima para registrar punto
  minTimeMs: number;               // Tiempo mínimo entre puntos
  maxAccuracyMeters: number;       // Precisión máxima aceptable
  adaptiveSpeedThreshold: number;  // m/s - debajo de esto, reduce frecuencia
}

const DEFAULT_CONFIG: GPSConfig = {
  minDistanceMeters: 5,            // No registrar si movimiento < 5m
  minTimeMs: 2000,                 // Mínimo 2s entre puntos
  maxAccuracyMeters: 25,           // Ignorar si precisión > 25m
  adaptiveSpeedThreshold: 2,       // ~7 km/h (caminar rápido)
};

interface AdaptiveGPSState {
  lastPoint: Coordinate | null;
  lastTimestamp: number;
  lastSpeed: number;
  pointsBuffer: Coordinate[];
  totalDistance: number;
}

export const useAdaptiveGPS = (config: Partial<GPSConfig> = {}) => {
  const settings = { ...DEFAULT_CONFIG, ...config };
  const stateRef = useRef<AdaptiveGPSState>({
    lastPoint: null,
    lastTimestamp: 0,
    lastSpeed: 0,
    pointsBuffer: [],
    totalDistance: 0,
  });

  const shouldRecordPoint = useCallback((
    newPoint: Coordinate,
    accuracy: number | undefined,
    timestamp: number
  ): { shouldRecord: boolean; distance: number; reason?: string } => {
    const state = stateRef.current;

    // 1. Filtrar por precisión
    if (accuracy && accuracy > settings.maxAccuracyMeters) {
      return { 
        shouldRecord: false, 
        distance: 0, 
        reason: `Precisión baja: ${accuracy.toFixed(0)}m > ${settings.maxAccuracyMeters}m` 
      };
    }

    // 2. Primer punto siempre se registra
    if (!state.lastPoint) {
      return { shouldRecord: true, distance: 0 };
    }

    const timeDiff = timestamp - state.lastTimestamp;
    const distance = calculatePathDistance([state.lastPoint, newPoint]);

    // 3. Calcular velocidad actual (m/s)
    const currentSpeed = timeDiff > 0 ? (distance / (timeDiff / 1000)) : 0;

    // 4. Ajustar intervalo mínimo basado en velocidad
    let adaptiveMinTime = settings.minTimeMs;
    if (currentSpeed < settings.adaptiveSpeedThreshold) {
      // Movimiento lento: aumentar intervalo (ahorro de batería)
      adaptiveMinTime = settings.minTimeMs * 2;
    } else if (currentSpeed > settings.adaptiveSpeedThreshold * 3) {
      // Movimiento rápido: reducir intervalo (más precisión)
      adaptiveMinTime = Math.max(1000, settings.minTimeMs / 2);
    }

    // 5. Verificar tiempo mínimo
    if (timeDiff < adaptiveMinTime) {
      return { 
        shouldRecord: false, 
        distance, 
        reason: `Tiempo insuficiente: ${timeDiff}ms < ${adaptiveMinTime}ms` 
      };
    }

    // 6. Verificar distancia mínima
    if (distance < settings.minDistanceMeters) {
      return { 
        shouldRecord: false, 
        distance, 
        reason: `Distancia insuficiente: ${distance.toFixed(1)}m < ${settings.minDistanceMeters}m` 
      };
    }

    // 7. Detectar puntos anómalos (velocidad imposible > 50 km/h = ~14 m/s)
    if (currentSpeed > 14 && state.lastSpeed < 5) {
      return { 
        shouldRecord: false, 
        distance, 
        reason: `Salto anómalo: ${(currentSpeed * 3.6).toFixed(1)} km/h` 
      };
    }

    return { shouldRecord: true, distance };
  }, [settings]);

  const recordPoint = useCallback((
    point: Coordinate,
    accuracy: number | undefined,
    timestamp: number = Date.now()
  ): { recorded: boolean; distance: number; totalDistance: number } => {
    const { shouldRecord, distance, reason } = shouldRecordPoint(point, accuracy, timestamp);
    
    if (!shouldRecord) {
      if (reason) {
        console.debug(`[GPS Adaptativo] Punto ignorado: ${reason}`);
      }
      return { 
        recorded: false, 
        distance: 0, 
        totalDistance: stateRef.current.totalDistance 
      };
    }

    const state = stateRef.current;
    const timeDiff = state.lastTimestamp > 0 ? timestamp - state.lastTimestamp : 0;
    const currentSpeed = timeDiff > 0 ? (distance / (timeDiff / 1000)) : 0;

    // Actualizar estado
    stateRef.current = {
      lastPoint: point,
      lastTimestamp: timestamp,
      lastSpeed: currentSpeed,
      pointsBuffer: [...state.pointsBuffer, point],
      totalDistance: state.totalDistance + distance,
    };

    console.debug(`[GPS Adaptativo] Punto registrado: +${distance.toFixed(1)}m, velocidad: ${(currentSpeed * 3.6).toFixed(1)} km/h`);

    return { 
      recorded: true, 
      distance, 
      totalDistance: stateRef.current.totalDistance 
    };
  }, [shouldRecordPoint]);

  const reset = useCallback(() => {
    stateRef.current = {
      lastPoint: null,
      lastTimestamp: 0,
      lastSpeed: 0,
      pointsBuffer: [],
      totalDistance: 0,
    };
  }, []);

  const getStats = useCallback(() => ({
    pointsCount: stateRef.current.pointsBuffer.length,
    totalDistance: stateRef.current.totalDistance,
    lastSpeed: stateRef.current.lastSpeed,
    lastPoint: stateRef.current.lastPoint,
  }), []);

  return {
    recordPoint,
    shouldRecordPoint,
    reset,
    getStats,
    config: settings,
  };
};
