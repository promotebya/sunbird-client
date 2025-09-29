// navigation/AppNavigator.tsx
import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import ChallengesScreen from '../screens/ChallengesScreen';
import HomeScreen from '../screens/HomeScreen';
import LoveNotesScreen from '../screens/LoveNotesScreen';
import MemoriesScreen from '../screens/MemoriesScreen';
import PairingScanScreen from '../screens/PairingScanScreen';
import PaywallScreen from '../screens/PaywallScreen';
import SettingsScreen from '../screens/SettingsScreen';
import TasksScreen from '../screens/TasksScreen';

import RemindersStack from './RemindersStack';

import { useTokens } from '../components/ThemeProvider';
import useAuthListener from '../hooks/useAuthListener';
import usePendingRemindersBadge from '../hooks/usePendingRemindersBadge';

const Tab = createBottomTabNavigator();
const Root = createNativeStackNavigator();

function Tabs() {
  const { user } = useAuthListener();
  const { badge } = usePendingRemindersBadge(user?.uid ?? null);
  const t = useTokens();

  return (
    <Tab.Navigator
      initialRouteName="Home"
      backBehavior="history"
      screenOptions={({ route }) => ({
        headerShown: false,
        sceneContainerStyle: { backgroundColor: t.colors.bg },
        tabBarActiveTintColor: t.colors.primary,
        tabBarInactiveTintColor: t.colors.textDim,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          backgroundColor: t.colors.card,
          borderTopColor: t.colors.border,
        },
        tabBarIcon: ({ color, size }) => {
          const map: Record<string, keyof typeof Ionicons.glyphMap> = {
            Home: 'home',
            Memories: 'images',
            Reminders: 'alarm',
            LoveNotes: 'heart',
            Tasks: 'checkmark-done',
            Challenges: 'sparkles',
          };
          const name = map[route.name] ?? 'ellipse';
          return <Ionicons name={name} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Memories" component={MemoriesScreen} />
      <Tab.Screen
        name="Reminders"
        component={RemindersStack}
        options={{
          tabBarBadge: badge ?? undefined,
          tabBarBadgeStyle: {
            backgroundColor: t.colors.primary,
            color: '#fff',
          },
        }}
      />
      <Tab.Screen
        name="LoveNotes"
        component={LoveNotesScreen}
        options={{ title: 'Love Notes' }}
      />
      <Tab.Screen name="Tasks" component={TasksScreen} />
      <Tab.Screen name="Challenges" component={ChallengesScreen} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const t = useTokens();
  return (
    <Root.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: t.colors.bg }, // ✅ fixes black background on stacks/modals
      }}
    >
      <Root.Screen name="Tabs" component={Tabs} />

      <Root.Screen
        name="Paywall"
        component={PaywallScreen}
        options={{
          headerShown: true,
          title: 'Premium',
          presentation: 'modal',
        }}
      />

      <Root.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ headerShown: true, title: 'Settings' }}
      />
      <Root.Screen
        name="PairingScan"
        component={PairingScanScreen}
        options={{ headerShown: true, title: 'Scan code' }}
      />
    </Root.Navigator>
  );
}