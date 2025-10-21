// navigation/AppNavigator.tsx
import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { Alert, Platform, ScrollView, Text, View } from 'react-native';

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
import { SpotlightProvider, SpotlightTarget } from '../components/spotlight';
import ThemedText from '../components/ThemedText';
import { useTokens } from '../components/ThemeProvider';
import useAuthListener from '../hooks/useAuthListener';
import usePendingRemindersBadge from '../hooks/usePendingRemindersBadge';

import { addDoc, collection, getFirestore, serverTimestamp } from 'firebase/firestore';

/* ---------------- Error boundary ---------------- */
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

/** Minimal ChallengeDetail so “Start challenge” can award points */
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
      <Button label="Got it!" onPress={() => navigation.goBack()} />
    </ScrollView>
  );
}

function Tabs() {
  const { user } = useAuthListener();
  const { badge } = usePendingRemindersBadge(user?.uid ?? null);
  const t = useTokens();

  const iosIcon = (fallback: number) => (Platform.OS === 'ios' ? 23 : fallback);
  const makeIOSLabel =
    (text: string) =>
    ({ color }: { focused: boolean; color: string }) =>
      (
        <Text
          allowFontScaling={false}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.8}
          style={{ fontSize: 9, fontWeight: '600', color }}
        >
          {text}
        </Text>
      );

  return (
    <Tab.Navigator
      initialRouteName="Home"
      backBehavior="history"
      screenOptions={() => ({
        headerShown: false,
        tabBarActiveTintColor: t.colors.primary,
        tabBarInactiveTintColor: t.colors.textDim,

        // Make the real tab bar the Spotlight target on iOS so we can highlight it.
        tabBarBackground: () =>
          Platform.OS === 'ios' ? (
            <SpotlightTarget id="tabbar" style={{ flex: 1 }}>
              <View style={{ flex: 1, backgroundColor: t.colors.card }} />
            </SpotlightTarget>
          ) : (
            <View style={{ flex: 1, backgroundColor: t.colors.card }} />
          ),

        tabBarStyle: {
          backgroundColor: 'transparent',
          borderTopColor: t.colors.border,
        },

        tabBarItemStyle: Platform.OS === 'android' ? { paddingVertical: 0 } : undefined,
        tabBarLabelStyle:
          Platform.OS === 'android'
            ? { fontSize: 12, fontWeight: '600', letterSpacing: 0.2, includeFontPadding: false }
            : undefined,

        tabBarAllowFontScaling: Platform.OS !== 'ios',
        tabBarHideOnKeyboard: true,
        lazy: true,
        detachInactiveScreens: true,
        sceneContainerStyle: { backgroundColor: t.colors.bg },
      })}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarLabel: Platform.OS === 'ios' ? makeIOSLabel('Home') : undefined,
          tabBarIcon: ({ color, size }) => <Ionicons name="home" size={iosIcon(size)} color={color} />,
        }}
      />
      <Tab.Screen
        name="LoveNotes"
        component={LoveNotesScreen}
        options={{
          title: 'Love Notes',
          tabBarLabel: Platform.OS === 'ios' ? makeIOSLabel('Love Notes') : undefined,
          tabBarIcon: ({ color, size }) => <Ionicons name="heart" size={iosIcon(size)} color={color} />,
        }}
      />
      <Tab.Screen
        name="Tasks"
        component={TasksScreen}
        options={{
          tabBarLabel: Platform.OS === 'ios' ? makeIOSLabel('Tasks') : undefined,
          tabBarIcon: ({ color, size }) => <Ionicons name="checkmark-done" size={iosIcon(size)} color={color} />,
        }}
      />
      <Tab.Screen
        name="Memories"
        component={MemoriesScreen}
        options={{
          tabBarLabel: Platform.OS === 'ios' ? makeIOSLabel('Memories') : undefined,
          tabBarIcon: ({ color, size }) => <Ionicons name="images" size={iosIcon(size)} color={color} />,
        }}
      />
      <Tab.Screen
        name="Reminders"
        component={RemindersStack}
        options={{
          tabBarLabel: Platform.OS === 'ios' ? makeIOSLabel('Reminders') : undefined,
          tabBarIcon: ({ color, size }) => <Ionicons name="alarm" size={iosIcon(size)} color={color} />,
          tabBarBadge: badge ?? undefined,
          tabBarBadgeStyle: { backgroundColor: t.colors.primary, color: '#fff' },
        }}
      />
      <Tab.Screen
        name="Challenges"
        component={ChallengesScreen}
        options={{
          tabBarLabel: Platform.OS === 'ios' ? makeIOSLabel('Challenges') : undefined,
          tabBarIcon: ({ color, size }) => <Ionicons name="sparkles" size={iosIcon(size)} color={color} />,
        }}
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
          screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.colors.bg } }}
        >
          <Root.Screen name="Tabs" component={Tabs} />
          <Root.Screen
            name="ChallengeDetail"
            component={ChallengeDetailScreen}
            options={{ headerShown: true, title: 'Challenge', presentation: 'card' }}
          />
          <Root.Screen
            name="Paywall"
            component={PaywallScreen}
            options={{ headerShown: false, presentation: Platform.OS === 'ios' ? 'modal' : 'card' }}
          />
          <Root.Screen name="Settings" component={SettingsScreen} options={{ headerShown: true, title: 'Settings' }} />
          <Root.Screen name="PairingScan" component={PairingScanScreen} options={{ headerShown: true, title: 'Scan code' }} />
        </Root.Navigator>
      </NavErrorBoundary>
    </SpotlightProvider>
  );
}