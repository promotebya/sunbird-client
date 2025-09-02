import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import * as React from 'react';

import type { RootTabParamList } from './types';

// Screens
import HomeScreen from '../screens/HomeScreen';
import LoveNotesScreen from '../screens/LoveNotesScreen';
import MemoriesScreen from '../screens/MemoriesScreen';
import PointsScreen from '../screens/PointsScreen';
import RemindersScreen from '../screens/RemindersScreen';
import TasksScreen from '../screens/TasksScreen';

// IMPORTANT: Do NOT wrap this in <NavigationContainer/> here.
// App.tsx should own the single NavigationContainer.

const Tab = createBottomTabNavigator<RootTabParamList>();

export default function AppNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#e91e63',
        tabBarInactiveTintColor: '#8e8e93',
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'ellipse';

          switch (route.name) {
            case 'Home':
              iconName = focused ? 'home' : 'home-outline';
              break;
            case 'Memories':
              iconName = focused ? 'images' : 'images-outline';
              break;
            case 'Points':
              iconName = focused ? 'trophy' : 'trophy-outline';
              break;
            case 'Tasks':
              iconName = focused ? 'checkbox' : 'checkbox-outline';
              break;
            case 'Reminders':
              iconName = focused ? 'alarm' : 'alarm-outline';
              break;
            case 'LoveNotes':
              iconName = focused ? 'heart' : 'heart-outline';
              break;
          }
          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Memories" component={MemoriesScreen} />
      <Tab.Screen name="Points" component={PointsScreen} />
      <Tab.Screen name="Tasks" component={TasksScreen} />
      <Tab.Screen name="Reminders" component={RemindersScreen} />
      <Tab.Screen
        name="LoveNotes"
        component={LoveNotesScreen}
        options={{ title: 'Love Notes' }}
      />
    </Tab.Navigator>
  );
}
