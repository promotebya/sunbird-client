// App.tsx
import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import React, { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import useAuthListener from './hooks/useAuthListener';
import useColorScheme from './hooks/useColorScheme';
import AppNavigator from './navigation/AppNavigator';
import AuthNavigator from './navigation/AuthNavigator';

// Make foreground notifications show an alert + sound
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function App() {
  const colorScheme = useColorScheme();
  const { user } = useAuthListener();

  // Ask permission once on mount (safe for SDK 49/50/51)
  useEffect(() => {
    const askPerms = async () => {
      if (!Device.isDevice) return;
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== 'granted') {
        await Notifications.requestPermissionsAsync();
      }
    };
    askPerms();
  }, []);

  return (
    <SafeAreaProvider>
      <NavigationContainer theme={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        {user ? <AppNavigator /> : <AuthNavigator />}
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
