import { NavigationContainer } from '@react-navigation/native';
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