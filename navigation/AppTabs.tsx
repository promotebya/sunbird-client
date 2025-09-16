// navigation/AppTabs.tsx
import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { tokens } from '../components/tokens';

// Your existing screens
import HomeScreen from '../screens/HomeScreen';
import LoveNotesScreen from '../screens/LoveNotesScreen';
import MemoriesScreen from '../screens/MemoriesScreen';
import PointsScreen from '../screens/PointsScreen';
import RemindersScreen from '../screens/RemindersScreen';
import TasksScreen from '../screens/TasksScreen';

// New feature screens are available from the root stack (not in the tab bar)
// import ChallengesScreen from '../screens/ChallengesScreen';
// import DiscoverScreen from '../screens/DiscoverScreen';

export type TabsParamList = {
  Home: undefined;
  Memories: undefined;
  Points: undefined;
  Reminders: undefined;
  LoveNotes: undefined;
  Tasks: undefined;
};

const Tab = createBottomTabNavigator<TabsParamList>();

export default function AppTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: tokens.colors.primary,
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarStyle: { backgroundColor: '#fff' },
        tabBarIcon: ({ color, size }) => {
          const map: Record<string, keyof typeof Ionicons.glyphMap> = {
            Home: 'home',
            Memories: 'images',
            Points: 'trophy',
            Reminders: 'alarm',
            LoveNotes: 'heart',
            Tasks: 'checkmark-done',
          };
          const name = map[route.name] ?? 'ellipse';
          return <Ionicons name={name} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Memories" component={MemoriesScreen} />
      <Tab.Screen name="Points" component={PointsScreen} />
      <Tab.Screen name="Reminders" component={RemindersScreen} />
      <Tab.Screen name="LoveNotes" component={LoveNotesScreen} />
      <Tab.Screen name="Tasks" component={TasksScreen} />
    </Tab.Navigator>
  );
}
