// navigation/AppTabs.tsx
import { Ionicons } from '@expo/vector-icons';
import { BottomTabBarProps, createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SpotlightTarget } from '../components/spotlight';
import { tokens } from '../components/tokens';

// screens...
import ChallengesScreen from '../screens/ChallengesScreen';
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
  Challenges: undefined;
};

const Tab = createBottomTabNavigator<TabsParamList>();

const ICONS: Record<keyof TabsParamList, keyof typeof Ionicons.glyphMap> = {
  Home: 'home',
  Memories: 'images',
  Reminders: 'alarm',
  LoveNotes: 'heart',
  Tasks: 'checkmark-done',
  Challenges: 'sparkles',
};

const TARGET_IDS: Record<keyof TabsParamList, string> = {
  Home: 'tab-home',
  Memories: 'tab-memories',
  Reminders: 'tab-reminders',
  LoveNotes: 'tab-love',
  Tasks: 'tab-tasks',
  Challenges: 'tab-challenges',
};

function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const activeTint = tokens.colors.primary;
  const inactiveTint = '#9CA3AF';

  return (
    // Wrap the REAL bar so Spotlight measures the exact rectangle
    <SpotlightTarget id="tabbar">
      <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const color = isFocused ? activeTint : inactiveTint;
          const iconName = ICONS[route.name as keyof TabsParamList];

          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name);
          };

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              style={styles.item}
              android_ripple={{ color: 'rgba(0,0,0,0.06)', radius: 80 }}
            >
              {/* Tight icon hitbox for future granular steps */}
              <SpotlightTarget id={TARGET_IDS[route.name as keyof TabsParamList]} style={styles.iconHit}>
                <Ionicons name={iconName} size={22} color={color} />
              </SpotlightTarget>
            </Pressable>
          );
        })}
      </View>
    </SpotlightTarget>
  );
}

export default function AppTabs() {
  return (
    <Tab.Navigator
      screenOptions={{ headerShown: false, tabBarStyle: { display: 'none' } }}
      tabBar={(props) => <CustomTabBar {...props} />}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Memories" component={MemoriesScreen} />
      <Tab.Screen name="Reminders" component={RemindersScreen} />
      <Tab.Screen name="LoveNotes" component={LoveNotesScreen} />
      <Tab.Screen name="Tasks" component={TasksScreen} />
      <Tab.Screen name="Challenges" component={ChallengesScreen} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#fff',
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
  },
  item: {
    width: 56,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconHit: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});