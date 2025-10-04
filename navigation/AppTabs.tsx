// navigation/AppTabs.tsx
import { Ionicons } from '@expo/vector-icons';
import { BottomTabBarProps, createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Pressable, StyleSheet, Text, View } from 'react-native';
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

const ICONS: Record<keyof TabsParamList, keyof typeof Ionicons.glyphMap> = {
  Home: 'home',
  Memories: 'images',
  Reminders: 'alarm',
  LoveNotes: 'heart',
  Tasks: 'checkmark-done',
};

// Spotlight ids (must match your tour steps)
const TARGET_IDS: Record<keyof TabsParamList, string> = {
  Home: 'tab-home',
  Memories: 'tab-memories',
  Reminders: 'tab-reminders',
  LoveNotes: 'tab-love',
  Tasks: 'tab-tasks',
};

const LABELS: Record<keyof TabsParamList, string> = {
  Home: 'Home',
  Memories: 'Memories',
  Reminders: 'Reminders',
  LoveNotes: 'Love Notes',
  Tasks: 'Tasks',
};

function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const activeTint = tokens.colors.primary;
  const inactiveTint = '#9CA3AF';

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {state.routes.map((route, index) => {
        const key = route.key;
        const name = route.name as keyof TabsParamList;
        const isFocused = state.index === index;
        const color = isFocused ? activeTint : inactiveTint;

        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: key, canPreventDefault: true });
          if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name);
        };

        const onLongPress = () => {
          navigation.emit({ type: 'tabLongPress', target: key });
        };

        const iconName = ICONS[name];
        const targetId = TARGET_IDS[name];

        return (
          <View key={key} style={styles.itemCol}>
            {/* Wrap the actual icon press target so Spotlight measures the real hitbox */}
            <SpotlightTarget id={targetId}>
              <Pressable
                onPress={onPress}
                onLongPress={onLongPress}
                accessibilityRole="button"
                accessibilityState={isFocused ? { selected: true } : {}}
                accessibilityLabel={LABELS[name]}
                style={styles.iconBtn}
                android_ripple={{ color: 'rgba(0,0,0,0.06)', radius: 80 }}
                testID={`tab-${name}`}
              >
                <Ionicons name={iconName} size={24} color={color} />
              </Pressable>
            </SpotlightTarget>

            {/* Label stays outside the spotlight hole so only the icon is highlighted */}
            <Text numberOfLines={1} style={[styles.label, { color }]}>{LABELS[name]}</Text>
          </View>
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
        tabBarStyle: { display: 'none' }, // hide the default bar; we render our own
      }}
      tabBar={(props) => <CustomTabBar {...props} />}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Memories" component={MemoriesScreen} />
      <Tab.Screen name="Reminders" component={RemindersScreen} />
      <Tab.Screen name="LoveNotes" component={LoveNotesScreen} />
      <Tab.Screen name="Tasks" component={TasksScreen} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    backgroundColor: '#fff',
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
  },
  itemCol: {
    width: 72, // stable width so spotlight hole doesn't jump
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtn: {
    width: 56,   // fixed icon hitbox → consistent Android measurement
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 12,
    marginTop: 2,
  },
});