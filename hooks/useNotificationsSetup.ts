// hooks/useNotificationsSetup.ts
import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import { Platform } from 'react-native';

export default function useNotificationsSetup() {
  useEffect(() => {
    Notifications.setNotificationHandler({
      handleNotification: async (): Promise<Notifications.NotificationBehavior> => {
        return {
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
          // iOS-specific flags — provide explicit booleans on all platforms
          shouldShowBanner: Platform.OS === 'ios',
          shouldShowList: Platform.OS === 'ios',
        };
      },
    });

    (async () => {
      // Ask permissions
      const current = await Notifications.getPermissionsAsync();
      if (current.status !== 'granted') {
        await Notifications.requestPermissionsAsync();
      }

      // Android channel
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.DEFAULT,
          sound: 'default',
        });
      }
    })();
  }, []);
}
