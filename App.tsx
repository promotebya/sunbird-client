// App.tsx
import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import useAuthListener from './hooks/useAuthListener';
import useColorScheme from './hooks/useColorScheme';
import useNotificationsSetup from './hooks/useNotificationsSetup';

import AppNavigator from './navigation/AppNavigator';
import AuthNavigator from './navigation/AuthNavigator';

export default function App() {
  const { user } = useAuthListener();
  const colorScheme = useColorScheme();

  // Set up notifications once
  useNotificationsSetup();

  return (
    <SafeAreaProvider>
      <NavigationContainer theme={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        {user ? <AppNavigator /> : <AuthNavigator />}
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
