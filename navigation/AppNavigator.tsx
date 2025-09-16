// navigation/AppNavigator.tsx
import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import ChallengesScreen from '../screens/ChallengesScreen'; // NEW
import HomeScreen from '../screens/HomeScreen';
import LoveNotesScreen from '../screens/LoveNotesScreen';
import MemoriesScreen from '../screens/MemoriesScreen';
import PairingScanScreen from '../screens/PairingScanScreen';
import PointsScreen from '../screens/PointsScreen';
import SettingsScreen from '../screens/SettingsScreen';
import TasksScreen from '../screens/TasksScreen';
import RemindersStack from './RemindersStack';

import { tokens } from '../components/tokens';
import useAuthListener from '../hooks/useAuthListener';
import usePendingRemindersBadge from '../hooks/usePendingRemindersBadge';

const Tab = createBottomTabNavigator();
const Root = createNativeStackNavigator();

function Tabs() {
  const { user } = useAuthListener();
  const { badge } = usePendingRemindersBadge(user?.uid ?? null);

  return (
    <Tab.Navigator
      initialRouteName="Home"
      backBehavior="history"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: tokens.colors.primary,
        tabBarInactiveTintColor: tokens.colors.textDim,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          backgroundColor: tokens.colors.card,
          borderTopColor: '#E5E7EB',
        },
        tabBarIcon: ({ color, size }) => {
          const map: Record<string, keyof typeof Ionicons.glyphMap> = {
            Home: 'home',
            Memories: 'images',
            Points: 'trophy',
            Tasks: 'checkmark-done',
            Reminders: 'alarm',
            LoveNotes: 'heart',
            Challenges: 'sparkles', // NEW
          };
          const name = map[route.name] ?? 'ellipse';
          return <Ionicons name={name} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Memories" component={MemoriesScreen} />
      <Tab.Screen name="Points" component={PointsScreen} />
      <Tab.Screen
        name="Reminders"
        component={RemindersStack}
        options={{
          tabBarBadge: badge ?? undefined, // keep type-safe (string | number | undefined)
          tabBarBadgeStyle: {
            backgroundColor: tokens.colors.primary,
            color: tokens.colors.buttonTextPrimary,
          },
        }}
      />
      <Tab.Screen name="LoveNotes" component={LoveNotesScreen} options={{ title: 'Love Notes' }} />
      <Tab.Screen name="Tasks" component={TasksScreen} />
      <Tab.Screen name="Challenges" component={ChallengesScreen} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  return (
    <Root.Navigator>
      <Root.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
      <Root.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
      <Root.Screen name="PairingScan" component={PairingScanScreen} options={{ title: 'Scan code' }} />
    </Root.Navigator>
  );
}
