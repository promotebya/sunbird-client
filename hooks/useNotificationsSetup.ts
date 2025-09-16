// hooks/useNotificationsSetup.ts
import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import { Platform } from 'react-native';

export default function useNotificationsSetup() {
  useEffect(() => {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        // Newer Expo types (iOS presentation)
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });

    (async () => {
      const { status: existing } = await Notifications.getPermissionsAsync();
      let status = existing;
      if (existing !== 'granted') {
        const req = await Notifications.requestPermissionsAsync();
        status = req.status;
      }

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.DEFAULT,
          sound: 'default',
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF4F8B',
        });
      }
    })();
  }, []);
}
