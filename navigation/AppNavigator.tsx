// navigation/AppNavigator.tsx
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';

import HomeScreen from '../screens/HomeScreen';
import MemoriesScreen from '../screens/MemoriesScreen';
import PointsScreen from '../screens/PointsScreen';
import TasksScreen from '../screens/TasksScreen';

// If you’ll show “Streak Saver” as a separate screen (optional):
// You can replace this with your real component later.
const StreakSaverScreen = () => null;

export type AppStackParamList = {
  Home: undefined;
  Tasks: undefined;
  Points: undefined;
  Memories: undefined;
  StreakSaver: undefined; // optional route for a dedicated screen
};

const Stack = createNativeStackNavigator<AppStackParamList>();

export default function AppNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerTitleAlign: 'center',
        headerShadowVisible: false,
        headerStyle: { backgroundColor: '#fff' },
        headerTintColor: '#1F1F1F',
      }}
    >
      <Stack.Screen
        name="Home"
        component={HomeScreen}
        options={{ title: 'Home' }}
      />

      <Stack.Screen
        name="Tasks"
        component={TasksScreen}
        options={{ title: 'Tasks' }}
      />

      <Stack.Screen
        name="Points"
        component={PointsScreen}
        options={{ title: 'Points' }}
      />

      <Stack.Screen
        name="Memories"
        component={MemoriesScreen}
        options={{ title: 'Memories' }}
      />

      {/* Optional: if you want a dedicated screen for “Streak Saver” */}
      <Stack.Screen
        name="StreakSaver"
        component={StreakSaverScreen}
        options={{ title: 'Streak Saver' }}
      />
    </Stack.Navigator>
  );
}
