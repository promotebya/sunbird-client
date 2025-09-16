// App.tsx
import { NavigationContainer } from '@react-navigation/native';
import 'react-native-gesture-handler'; // 👈 must be the first import
import { ThemeProvider } from './components/ThemeProvider';
import useAuthListener from './hooks/useAuthListener';
import usePartnerReminderListener from './hooks/usePartnerReminderListener';
import AppNavigator from './navigation/AppNavigator';
import AuthNavigator from './navigation/AuthNavigator';

export default function App() {
  const { user } = useAuthListener();
  usePartnerReminderListener(user?.uid ?? null);

  return (
    <ThemeProvider>
      <NavigationContainer>
        {user ? <AppNavigator /> : <AuthNavigator />}
      </NavigationContainer>
    </ThemeProvider>
  );
}
