import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useColorScheme } from '../hooks/useColorScheme';
import HomeScreen from '../screens/HomeScreen';
import MemoriesScreen from '../screens/MemoriesScreen';
import PointsScreen from '../screens/PointsScreen';
import RemindersScreen from '../screens/RemindersScreen';
import TasksScreen from '../screens/TasksScreen';

export type RootTabParamList = {
  Home: undefined;
  Tasks: undefined;
  Points: undefined;
  Memories: undefined;
  Reminders: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();

export default function AppNavigator() {
  const scheme = useColorScheme();

  return (
    <SafeAreaProvider>
      <NavigationContainer theme={scheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Tab.Navigator
          screenOptions={({ route }) => ({
            tabBarIcon: ({ color, size }) => {
              const map: Record<string, keyof typeof Ionicons.glyphMap> = {
                Home: 'home',
                Tasks: 'checkbox',
                Points: 'trophy',
                Memories: 'images',
                Reminders: 'notifications',
              };
              const name = map[route.name] ?? 'ellipse';
              return <Ionicons name={name} size={size} color={color} />;
            },
            headerShown: false,
            tabBarActiveTintColor: '#5B5BFF',
            tabBarStyle: { paddingTop: 4, height: 62 },
            tabBarLabelStyle: { fontWeight: '700', marginBottom: 6 },
          })}
        >
          <Tab.Screen name="Home" component={HomeScreen} />
          <Tab.Screen name="Tasks" component={TasksScreen} />
          <Tab.Screen name="Points" component={PointsScreen} />
          <Tab.Screen name="Memories" component={MemoriesScreen} />
          <Tab.Screen name="Reminders" component={RemindersScreen} />
        </Tab.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
