// App.tsx
import { NavigationContainer } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ThemeProvider } from './components/ThemeProvider';
import useAuthListener from './hooks/useAuthListener';
import usePartnerReminderListener from './hooks/usePartnerReminderListener';
import AppNavigator from './navigation/AppNavigator';
import AuthNavigator from './navigation/AuthNavigator';

export default function App() {
  const { user } = useAuthListener();

  // If your hook expects a uid, avoid calling it with null.
  // Wrap any uid-dependent logic INSIDE the hook using useEffect,
  // or make the hook no-op on falsy uid.
  usePartnerReminderListener(user?.uid ?? null);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <NavigationContainer>
          {user ? <AppNavigator /> : <AuthNavigator />}
        </NavigationContainer>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}