import { Capacitor, registerPlugin } from '@capacitor/core';

interface RunTrackingPlugin {
  startService(): Promise<void>;
  stopService(): Promise<void>;
}

const RunTracking = Capacitor.isNativePlatform()
  ? registerPlugin<RunTrackingPlugin>('RunTracking')
  : {
      startService: async () => undefined,
      stopService: async () => undefined,
    };

export const startRunTrackingService = async () => {
  if (Capacitor.getPlatform() !== 'android') return;
  try {
    await RunTracking.startService();
  } catch (error) {
    console.warn('No se pudo iniciar el servicio foreground', error);
  }
};

export const stopRunTrackingService = async () => {
  if (Capacitor.getPlatform() !== 'android') return;
  try {
    await RunTracking.stopService();
  } catch (error) {
    console.warn('No se pudo detener el servicio foreground', error);
  }
};
