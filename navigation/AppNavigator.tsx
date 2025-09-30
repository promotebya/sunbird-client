// navigation/AppNavigator.tsx
import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';

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
import { type SeedChallenge } from '../utils/seedchallenges';

// 🔥 Firestore (modular v9)
import {
  addDoc,
  collection,
  getFirestore,
  serverTimestamp,
} from 'firebase/firestore';

/* ---------------- Error boundary to avoid “black screen” ---------------- */
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

/** Minimal detail screen so "Start challenge" has a target + award points */
function ChallengeDetailScreen({ route, navigation }: any) {
  const t = useTokens();
  const { user } = useAuthListener();
  const [saving, setSaving] = useState(false);

  const seed: SeedChallenge | undefined = route?.params?.seed;
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

      // ✅ Write to TOP-LEVEL /points to match your Firestore rules
      await addDoc(collection(db, 'points'), {
        ownerId: user.uid,              // rules check this
        value: pts,                     // rules require number
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
      const msg =
        (e && typeof e === 'object' && 'message' in e) ? String(e.message)
        : 'Could not save your points. Please try again.';
      Alert.alert('Oops', msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.colors.bg }}
      contentContainerStyle={{ padding: t.spacing.lg }}
    >
      <ThemedText variant="display" style={{ marginBottom: t.spacing.s }}>
        {title}
      </ThemedText>

      <Card>
        <ThemedText variant="subtitle" color="textDim">
          {`+${pts} pts`}
        </ThemedText>
        <View style={{ height: t.spacing.s }} />
        <ThemedText>{desc}</ThemedText>
      </Card>

      <View style={{ height: t.spacing.md }} />
      <Button
        label={saving ? 'Saving…' : `Mark finished (+${pts} pts)`}
        onPress={markFinished}
        disabled={saving}
      />
      <View style={{ height: t.spacing.s }} />
      <Button
        label="Got it!"
        onPress={() => navigation.goBack()}
      />
    </ScrollView>
  );
}

function Tabs() {
  const { user } = useAuthListener();
  const { badge } = usePendingRemindersBadge(user?.uid ?? null);
  const t = useTokens();

  return (
    <Tab.Navigator
      initialRouteName="Home"
      backBehavior="history"
      // 👇 avoid mounting all tabs up front (can crash on slow/invalid screens)
      screenOptions={({ route }: { route: any }) => ({
        headerShown: false,
        sceneContainerStyle: { backgroundColor: t.colors.bg },
        tabBarActiveTintColor: t.colors.primary,
        tabBarInactiveTintColor: t.colors.textDim,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          backgroundColor: t.colors.card,
          borderTopColor: t.colors.border,
        },
        lazy: true,                 // <—
        detachInactiveScreens: true // <—
      })}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
        }}
      />

      <Tab.Screen
        name="Memories"
        component={MemoriesScreen}
        options={{
          tabBarIcon: ({ color, size }) => <Ionicons name="images" size={size} color={color} />,
        }}
      />

      <Tab.Screen
        name="Reminders"
        component={RemindersStack}
        options={{
          tabBarIcon: ({ color, size }) => <Ionicons name="alarm" size={size} color={color} />,
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
        options={{
          title: 'Love Notes',
          tabBarIcon: ({ color, size }) => <Ionicons name="heart" size={size} color={color} />,
        }}
      />

      <Tab.Screen
        name="Tasks"
        component={TasksScreen}
        options={{
          tabBarIcon: ({ color, size }) => <Ionicons name="checkmark-done" size={size} color={color} />,
        }}
      />

      <Tab.Screen
        name="Challenges"
        component={ChallengesScreen}
        options={{
          tabBarIcon: ({ color, size }) => <Ionicons name="sparkles" size={size} color={color} />,
        }}
      />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const t = useTokens();
  return (
    <NavErrorBoundary t={t}>
      <Root.Navigator
        initialRouteName="Tabs"
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: t.colors.bg }, // ✅ fixes black background on stacks/modals
        }}
      >
        <Root.Screen name="Tabs" component={Tabs} />

        {/* Challenge detail target so the button can navigate */}
        <Root.Screen
          name="ChallengeDetail"
          component={ChallengeDetailScreen}
          options={{
            headerShown: true,
            title: 'Challenge',
            presentation: 'card',
          }}
        />

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
    </NavErrorBoundary>
  );
}