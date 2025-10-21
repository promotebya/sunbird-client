// navigation/AppTabs.tsx
import { Ionicons } from '@expo/vector-icons';
import { BottomTabBarProps, createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SpotlightTarget } from '../components/spotlight';
import { useTokens } from '../components/ThemeProvider';
import useAndroidNavBar from '../hooks/useAndroidNavBar';

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
  const t = useTokens();

  // Keep Android system navigation bar in sync and fully opaque
  useAndroidNavBar();

  const activeTint = t.colors.primary;
  const inactiveTint = '#9CA3AF';

  // a small extra band that rises above the bar without changing hitbox
  const bandExtra = 12;
  const barHeight = 56 + Math.max(insets.bottom, 8);

  // Paint bar & pad for bottom inset so labels/icons never sit under the system nav bar
  const barDynamic = useMemo(
    () => ({
      backgroundColor: t.colors.card,
      borderTopColor: t.colors.border,
      paddingBottom: Math.max(insets.bottom, 8),
      height: barHeight,
    }),
    [t.colors.card, t.colors.border, insets.bottom, barHeight]
  );

  return (
    <SpotlightTarget id="tabbar" style={{ position: 'relative' }}>
      {/* Underlay that extends ABOVE the bar a bit to create the light strip effect */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: barHeight + bandExtra,
          backgroundColor: t.colors.card,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: t.colors.border,
          transform: [{ translateY: -bandExtra }],
        }}
      />
      {/* The real bar (keeps normal height) */}
      <View style={[styles.bar, barDynamic]}>
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const color = isFocused ? activeTint : inactiveTint;
          const iconName = ICONS[route.name as keyof TabsParamList];

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
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
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
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