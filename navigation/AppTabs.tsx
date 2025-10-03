// navigation/AppTabs.tsx
import { Ionicons } from '@expo/vector-icons';
import {
  createBottomTabNavigator,
  type BottomTabBarProps,
} from '@react-navigation/bottom-tabs';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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

export default function AppTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
      }}
      // 👇 Custom tab bar with spotlight bridges
      tabBar={(props) => <TabBarWithSpotlight {...props} />}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Memories" component={MemoriesScreen} />
      <Tab.Screen name="Reminders" component={RemindersScreen} />
      <Tab.Screen name="LoveNotes" component={LoveNotesScreen} />
      <Tab.Screen name="Tasks" component={TasksScreen} />
    </Tab.Navigator>
  );
}

function TabBarWithSpotlight({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { width: W } = useWindowDimensions();

  const routes = state.routes as Array<{ key: string; name: keyof TabsParamList }>;
  const TAB_COUNT = routes.length;
  const SEG = W / TAB_COUNT;

  // Bar and target sizing
  const BAR_CORE_H = 56;                    // icon row
  const BAR_H = BAR_CORE_H + insets.bottom; // full bar including safe area
  const TARGET_W = Math.min(56, SEG - 20);  // narrow, centered over icon
  const TARGET_H = 42;
  const bottom = insets.bottom + (BAR_CORE_H - TARGET_H) / 2;

  const primary = tokens.colors.primary;
  const inactive = '#9CA3AF';

  const iconNameForRoute: Record<keyof TabsParamList, keyof typeof Ionicons.glyphMap> = {
    Home: 'home',
    Memories: 'images',
    Reminders: 'alarm',
    LoveNotes: 'heart',
    Tasks: 'checkmark-done',
  };

  const spotlightIdForRoute: Record<keyof TabsParamList, string> = {
    Home: 'tab-home',
    Memories: 'tab-memories',
    Reminders: 'tab-reminders',
    LoveNotes: 'tab-love',
    Tasks: 'tab-tasks',
  };

  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom }]}>
      {/* Visible tab items */}
      <View style={[styles.itemsRow, { height: BAR_CORE_H }]}>
        {routes.map((route, index) => {
          const isFocused = state.index === index;
          const color = isFocused ? primary : inactive;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <View
              key={route.key}
              style={[styles.item, { width: SEG }]}
              // Press handling on parent view to keep SpotlightTarget clean
              onTouchEnd={onPress as any}
            >
              <Ionicons
                name={iconNameForRoute[route.name]}
                size={24}
                color={color}
              />
            </View>
          );
        })}
      </View>

      {/* Invisible Spotlight targets precisely over each icon */}
      {routes.map((route, i) => {
        const left = i * SEG + (SEG - TARGET_W) / 2;
        return (
          <SpotlightTarget
            key={`spot-${route.key}`}
            id={spotlightIdForRoute[route.name]}
            style={{
              position: 'absolute',
              left,
              bottom,
              width: TARGET_W,
              height: TARGET_H,
              // no background; this is a measurement-only bridge
            }}
          >
            <View />
          </SpotlightTarget>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
  },
  itemsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  item: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});