import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as React from 'react';

import type { AuthStackParamList } from './types';

// Screens
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';

// IMPORTANT: Do NOT wrap this in <NavigationContainer/> here.
// App.tsx should own the single NavigationContainer.

const Stack = createNativeStackNavigator<AuthStackParamList>();

export default function AuthNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
    </Stack.Navigator>
  );
}
