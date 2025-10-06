import { Ionicons } from '@expo/vector-icons';
import {
  createBottomTabNavigator,
  type BottomTabBarButtonProps,
} from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, View } from 'react-native';

import ChallengesScreen from '../screens/ChallengesScreen';
import HomeScreen from '../screens/HomeScreen';
import LoveNotesScreen from '../screens/LoveNotesScreen';
import MemoriesScreen from '../screens/MemoriesScreen';
import PairingScanScreen from '../screens/PairingScanScreen';
import PaywallScreen from '../screens/PaywallScreen';
import SettingsScreen from '../screens/SettingsScreen';
import TasksScreen from '../screens/TasksScreen';

import RemindersStack from './RemindersStack';

import Button from '../components/Button';
import Card from '../components/Card';
import ThemedText from '../components/ThemedText';
import { useTokens } from '../components/ThemeProvider';
import useAuthListener from '../hooks/useAuthListener';
import usePendingRemindersBadge from '../hooks/usePendingRemindersBadge';

// Overlay only (doesn't alter layout)
import { SpotlightProvider } from '../components/spotlight';

import { addDoc, collection, getFirestore, serverTimestamp } from 'firebase/firestore';

class NavErrorBoundary extends React.Component<
  { children: React.ReactNode; t: ReturnType<typeof useTokens> },
  { error: any }
> {
  constructor(props: any) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: any) {
    return { error };
  }
  render() {
    const { error } = this.state;
    const t = (this.props as any).t as ReturnType<typeof useTokens>;
    if (!error) return this.props.children as any;
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: t.colors.bg }}
        contentContainerStyle={{ padding: t.spacing.lg }}
      >
        <Card>
          <ThemedText variant="display">Something went wrong</ThemedText>
          <ThemedText variant="caption" color="textDim" style={{ marginTop: 6 }}>
            {String(error?.message ?? error ?? 'Unknown error')}
          </ThemedText>
        </Card>
      </ScrollView>
    );
  }
}

const Tab = createBottomTabNavigator();
const Root = createNativeStackNavigator();

/** Minimal detail screen so "Start challenge" awards points */
function ChallengeDetailScreen({ route, navigation }: any) {
  const t = useTokens();
  const { user } = useAuthListener();
  const [saving, setSaving] = useState(false);

  const seed: any = route?.params?.seed;
  const title = seed?.title ?? 'Challenge';
  const desc = seed?.description ?? '';
  const pts = Number(seed?.points ?? 0);

  async function markFinished() {
    if (!user?.uid) {
      Alert.alert('Sign in required', 'Please sign in to earn points.');
      return;
    }
    if (saving) return;

    try {
      setSaving(true);
      const db = getFirestore();
      await addDoc(collection(db, 'points'), {
        ownerId: user.uid,
        value: pts,
        type: 'challenge',
        challengeId: seed?.id ?? null,
        title: seed?.title ?? null,
        difficulty: seed?.difficulty ?? null,
        createdAt: serverTimestamp(),
      });
      Alert.alert('Nice!', `+${pts} points added.`);
      navigation.goBack();
    } catch (e: any) {
      console.warn('award points failed', e);
      Alert.alert('Oops', e?.message ?? 'Could not save your points.');
    } finally {
      setSaving(false);
    }
  }

  const tkn = useTokens();

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: tkn.colors.bg }}
      contentContainerStyle={{ padding: tkn.spacing.lg }}
    >
      <ThemedText variant="display" style={{ marginBottom: tkn.spacing.s }}>
        {title}
      </ThemedText>

      <Card>
        <ThemedText variant="subtitle" color="textDim">
          {`+${pts} pts`}
        </ThemedText>
        <View style={{ height: tkn.spacing.s }} />
        <ThemedText>{desc}</ThemedText>
      </Card>

      <View style={{ height: tkn.spacing.md }} />
      <Button
        label={saving ? 'Saving…' : `Mark finished (+${pts} pts)`}
        onPress={markFinished}
        disabled={saving}
      />
      <View style={{ height: tkn.spacing.s }} />
      <Button label="Got it!" onPress={() => navigation.goBack()} />
    </ScrollView>
  );
}

function withAlpha(hex: string, alpha: number) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const r = parseInt(full.substring(0, 2), 16);
  const g = parseInt(full.substring(2, 4), 16);
  const b = parseInt(full.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function Tabs() {
  const { user } = useAuthListener();
  const { badge } = usePendingRemindersBadge(user?.uid ?? null);
  const t = useTokens();

  const renderTabBarButton = (props: BottomTabBarButtonProps) =>
    Platform.OS === 'android' ? (
      <Pressable
        {...(props as any)}
        android_ripple={{ color: withAlpha(t.colors.primary, 0.14), radius: 46, borderless: false }}
        style={[props.style, { overflow: 'hidden', borderRadius: 24 }]}
      />
    ) : (
      // On iOS, use the default native tab bar button for perfect layout
      (props as any).children
    );

  return (
    <Tab.Navigator
      initialRouteName="Home"
      backBehavior="history"
      screenOptions={() => ({
        headerShown: false,

        tabBarActiveTintColor: t.colors.primary,
        tabBarInactiveTintColor: t.colors.textDim,

        tabBarStyle: {
          backgroundColor: t.colors.card,
          borderTopColor: t.colors.border,
          ...(Platform.OS === 'android' ? { height: 60, paddingTop: 6 } : {}),
        },

        tabBarItemStyle: Platform.OS === 'android' ? { paddingVertical: 2 } : undefined,

        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
          letterSpacing: 0.2,
          marginBottom: 0,
        },

        tabBarButton: Platform.OS === 'android' ? renderTabBarButton : undefined,

        tabBarHideOnKeyboard: true,
        lazy: true,
        detachInactiveScreens: true,
      })}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} /> }}
      />
      <Tab.Screen
        name="Memories"
        component={MemoriesScreen}
        options={{ tabBarIcon: ({ color, size }) => <Ionicons name="images" size={size} color={color} /> }}
      />
      <Tab.Screen
        name="Reminders"
        component={RemindersStack}
        options={{
          tabBarIcon: ({ color, size }) => <Ionicons name="alarm" size={size} color={color} />,
          tabBarBadge: badge ?? undefined,
          tabBarBadgeStyle: { backgroundColor: t.colors.primary, color: '#fff' },
        }}
      />
      <Tab.Screen
        name="LoveNotes"
        component={LoveNotesScreen}
        options={{ title: 'Love Notes', tabBarIcon: ({ color, size }) => <Ionicons name="heart" size={size} color={color} /> }}
      />
      <Tab.Screen
        name="Tasks"
        component={TasksScreen}
        options={{ tabBarIcon: ({ color, size }) => <Ionicons name="checkmark-done" size={size} color={color} /> }}
      />
      <Tab.Screen
        name="Challenges"
        component={ChallengesScreen}
        options={{ tabBarIcon: ({ color, size }) => <Ionicons name="sparkles" size={size} color={color} /> }}
      />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const t = useTokens();
  return (
    <SpotlightProvider>
      <NavErrorBoundary t={t}>
        <Root.Navigator
          initialRouteName="Tabs"
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: t.colors.bg },
          }}
        >
          <Root.Screen name="Tabs" component={Tabs} />

          <Root.Screen
            name="ChallengeDetail"
            component={ChallengeDetailScreen}
            options={{ headerShown: true, title: 'Challenge', presentation: 'card' }}
          />

          {/* Hide native header -> we render a perfectly placed in-screen back button */}
          <Root.Screen
            name="Paywall"
            component={PaywallScreen}
            options={{
              headerShown: false,
              presentation: Platform.OS === 'ios' ? 'modal' : 'card',
            }}
          />

          <Root.Screen name="Settings" component={SettingsScreen} options={{ headerShown: true, title: 'Settings' }} />
          <Root.Screen name="PairingScan" component={PairingScanScreen} options={{ headerShown: true, title: 'Scan code' }} />
        </Root.Navigator>
      </NavErrorBoundary>
    </SpotlightProvider>
  );
}