import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

// Real phone push (alerts even with the app closed), on top of the in-app
// bell. Only runs on the native Capacitor build - there's no web push setup
// (no service worker), so this is a no-op in the browser.
export function usePushNotifications() {
  const { supabaseUser } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!supabaseUser || !Capacitor.isNativePlatform()) return;

    let registrationListener: { remove: () => void } | undefined;
    let errorListener: { remove: () => void } | undefined;
    let tapListener: { remove: () => void } | undefined;

    (async () => {
      const current = await PushNotifications.checkPermissions();
      let status = current.receive;
      if (status === 'prompt' || status === 'prompt-with-rationale') {
        status = (await PushNotifications.requestPermissions()).receive;
      }
      if (status !== 'granted') return;

      registrationListener = await PushNotifications.addListener('registration', async (token) => {
        await supabase.from('device_push_tokens').upsert(
          {
            user_id: supabaseUser.id,
            token: token.value,
            platform: Capacitor.getPlatform(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'token' }
        );
      });

      errorListener = await PushNotifications.addListener('registrationError', (err) => {
        console.error('Push registration failed:', err);
      });

      // Tapping a push while the app is backgrounded/closed - deep-link
      // straight to the flight it's about, same as clicking the in-app bell.
      tapListener = await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
        const flightId = action.notification.data?.flight_id;
        navigate(flightId ? `/flights/${flightId}` : '/notifications');
      });

      await PushNotifications.register();
    })();

    return () => {
      registrationListener?.remove();
      errorListener?.remove();
      tapListener?.remove();
    };
  }, [supabaseUser, navigate]);
}
