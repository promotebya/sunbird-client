// hooks/useNotificationsSetup.ts
import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import { Platform } from 'react-native';

export default function useNotificationsSetup() {
  useEffect(() => {
    // Foreground behavior — make the return type explicit for TS across SDKs
    Notifications.setNotificationHandler({
      handleNotification: async (): Promise<Notifications.NotificationBehavior> => {
        const behavior = {
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
        } as unknown as Notifications.NotificationBehavior; // satisfy older/newer SDK typings
        return behavior;
      },
    });

    (async () => {
      // Ask for permissions if needed
      const perm = await Notifications.getPermissionsAsync();
      if (perm.status !== 'granted') {
        await Notifications.requestPermissionsAsync();
      }

      // Android notification channel (required for sound/vibration on Android)
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Default',
          importance: Notifications.AndroidImportance.MAX,
          sound: 'default',                  // string per current typings
          enableVibrate: true,
          vibrationPattern: [200, 200, 200],
          showBadge: true,
          lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        });
      }
    })();
  }, []);
}
