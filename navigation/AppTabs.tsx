import { Ionicons } from '@expo/vector-icons';
import { BottomTabBarProps, createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useCallback, useEffect, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSpotlight } from '../components/spotlight'; // ← use context to register exact rects
import { tokens } from '../components/tokens';

// Screens
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

  // ---- Explicit spotlight registration for each icon (Android-safe) ----
  const { registerTarget } = useSpotlight();
  const iconRefs = useRef<Partial<Record<keyof TabsParamList, View | null>>>({});

  const measureOne = useCallback((name: keyof TabsParamList) => {
    const ref = iconRefs.current[name];
    if (!ref) return;
    // @ts-ignore
    ref.measureInWindow?.((x: number, y: number, w: number, h: number) => {
      if (!w || !h) return;
      registerTarget(TARGET_IDS[name], { x, y, width: w, height: h });
    });
  }, [registerTarget]);

  const measureAll = useCallback(() => {
    (Object.keys(TARGET_IDS) as (keyof TabsParamList)[]).forEach((name) => {
      measureOne(name);
    });
  }, [measureOne]);

  // Re-measure when layout stabilizes and when active index changes
  const onBarLayout = () => {
    requestAnimationFrame(() => {
      measureAll();
      setTimeout(measureAll, 80);
      setTimeout(measureAll, 160);
    });
  };

  useEffect(() => {
    measureAll();
    const t = setTimeout(measureAll, 100);
    return () => clearTimeout(t);
  }, [state.index, measureAll]);

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 8) }]} onLayout={onBarLayout}>
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
            {/* Tight 36×36 view around the icon; this is what we measure */}
            <View
              ref={(el) => { iconRefs.current[route.name as keyof TabsParamList] = el; }}
              style={styles.iconHit}
              collapsable={false} // <- critical on Android so the view is measurable
              onLayout={() => {
                // measure a few times to defeat delayed layout/ripple
                measureOne(route.name as keyof TabsParamList);
                setTimeout(() => measureOne(route.name as keyof TabsParamList), 60);
              }}
            >
              <Ionicons name={iconName} size={22} color={color} />
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function AppTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: { display: 'none' }, // we render our own bar
      }}
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
  // This is the measurable icon hitbox the spotlight will hug
  iconHit: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});