import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

export const usePushNotifications = () => {
  const { user } = useAuth();

  useEffect(() => {
    const registerPush = async () => {
      if (!user) return;
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        return;
      }
      if (!VAPID_PUBLIC_KEY) {
        console.warn('Missing VITE_VAPID_PUBLIC_KEY for push notifications');
        return;
      }

      try {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          console.info('Push permission not granted');
          return;
        }

        const registration = await navigator.serviceWorker.register('/sw.js');
        await navigator.serviceWorker.ready;

        const existingSubscription = await registration.pushManager.getSubscription();
        const subscription = existingSubscription || await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });

        const subscriptionJson = subscription.toJSON();
        await supabase.from('push_subscriptions').upsert({
          user_id: user.id,
          endpoint: subscriptionJson.endpoint || '',
          p256dh: subscriptionJson.keys?.p256dh || '',
          auth: subscriptionJson.keys?.auth || '',
          expiration_time: subscriptionJson.expirationTime || null,
        });
        toast.success('Notificaciones activadas');
      } catch (error) {
        console.error('Error registering push notifications', error);
        toast.error('No se pudieron activar las notificaciones push');
      }
    };

    registerPush();
  }, [user]);
};

const urlBase64ToUint8Array = (base64String: string) => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
};
