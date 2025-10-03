// navigation/AppTabs.tsx
import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Pressable } from 'react-native';
import { SpotlightTarget } from '../components/spotlight';
import { tokens } from '../components/tokens';

// Screens
import HomeScreen from '../screens/HomeScreen';
import LoveNotesScreen from '../screens/LoveNotesScreen';
import MemoriesScreen from '../screens/MemoriesScreen';
import RemindersScreen from '../screens/RemindersScreen';
import TasksScreen from '../screens/TasksScreen';

export type TabsParamList = {
  Home: undefined;
  Memories: undefined;
  Reminders: undefined;
  LoveNotes: undefined;
  Tasks: undefined;
};

const Tab = createBottomTabNavigator<TabsParamList>();

// Helper to wrap the REAL tab button with a SpotlightTarget.
// This guarantees the coach mark circles the true tab area.
const wrapTabButton =
  (id: string) =>
  // BottomTabBarButtonProps is intentionally 'any' here to stay RN-version-agnostic
  (props: any) =>
    (
      <SpotlightTarget id={id} /* collapsable disabled inside component */>
        <Pressable
          {...props}
          android_ripple={{ color: 'rgba(0,0,0,0.06)', radius: 240 }}
          // Keep layout identical to default
          style={props.style}
        />
      </SpotlightTarget>
    );

export default function AppTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: tokens.colors.primary,
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarStyle: { backgroundColor: '#fff' },
        tabBarIcon: ({ color, size }) => {
          const map: Record<string, keyof typeof Ionicons.glyphMap> = {
            Home: 'home',
            Memories: 'images',
            Reminders: 'alarm',
            LoveNotes: 'heart',
            Tasks: 'checkmark-done',
          };
          return <Ionicons name={map[route.name] ?? 'ellipse'} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarButton: wrapTabButton('tab-home'),
        }}
      />
      <Tab.Screen
        name="Memories"
        component={MemoriesScreen}
        options={{
          tabBarButton: wrapTabButton('tab-memories'),
        }}
      />
      <Tab.Screen
        name="Reminders"
        component={RemindersScreen}
        options={{
          tabBarButton: wrapTabButton('tab-reminders'),
        }}
      />
      <Tab.Screen
        name="LoveNotes"
        component={LoveNotesScreen}
        options={{
          tabBarButton: wrapTabButton('tab-love'),
        }}
      />
      <Tab.Screen
        name="Tasks"
        component={TasksScreen}
        options={{
          tabBarButton: wrapTabButton('tab-tasks'),
        }}
      />
    </Tab.Navigator>
  );
}