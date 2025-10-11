// App.tsx
import { NavigationContainer } from '@react-navigation/native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef, useState } from 'react';
import { Animated, Image, LogBox, Platform, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ThemeProvider } from './components/ThemeProvider';
import { SpotlightProvider } from './components/spotlight';
import useAuthListener from './hooks/useAuthListener';
import usePartnerReminderListener from './hooks/usePartnerReminderListener';
import AppNavigator from './navigation/AppNavigator';
import AuthNavigator from './navigation/AuthNavigator';

// Firestore (to save Expo push tokens)
import { arrayUnion, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from './firebaseConfig';

// Quiet known noisy logs without hiding real errors
LogBox.ignoreLogs([
  'setLayoutAnimationEnabledExperimental is currently a no-op in the New Architecture.',
  'Uncaught Error in snapshot listener:',
  'Missing or insufficient permissions.',
  "WebChannelConnection RPC 'Listen' stream",
]);

// Keep native splash up until we decide to hide it (we'll hide ASAP on Android)
SplashScreen.preventAutoHideAsync().catch(() => {});

// ---------- Helpers for “Make their day” nudges ----------
const NUDGE_PROMPTS: string[] = [
  "What made you smile about your partner today? Tell them!",
  "Send a quick text: three things you love about them.",
  "Tell them one small thing they did recently that you noticed.",
  "Give a sincere compliment—be specific!",
  "Share a favorite memory you have together.",
  "Say thanks for something they do that you usually take for granted.",
  "Ask about their day, and really listen.",
  "Tell them what you’re looking forward to doing together.",
  "Leave a cute voice note right now.",
  "Remind them why you chose them.",
  "Send a photo that makes you think of them.",
  "Tell them one way they make your life better.",
  "Plan a tiny surprise for tonight.",
  "Write one sentence that starts with: “I appreciate you because…”",
  "Ask: “What would make today 1% better?”",
  "Share a song that fits your mood and why.",
  "Tell them what you admire about their character.",
  "Text: “Thinking of you—how’s your energy today?”",
  "Share a small inside joke.",
  "Offer help with one task they have this week.",
  "Suggest a tiny plan for tonight—tea, short walk, or a 10-minute game.",
  "Ask them about something they care about.",
  "Tell them one new thing you learned about them recently.",
  "Say: “I’m proud of you for ___.”",
  "Invite them for a 10-minute cuddle/check-in later.",
  "Send a heart + one word that describes them.",
  "Tell them why today you’re grateful for them.",
  "Ask: “What would you love to do together this weekend?”",
  "Say: “You looked great today because ___.”",
  "Text a quick pep talk—they deserve it!",
];

const randInt = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

function startOfWeekMonday(d = new Date()) {
  const copy = new Date(d);
  const day = copy.getDay();
  const diffToMon = (day + 6) % 7;
  copy.setHours(0, 0, 0, 0);
  copy.setDate(copy.getDate() - diffToMon);
  return copy;
}

function makeRandomWeeklyTriggers(targetCount: number): Date[] {
  const out: Date[] = [];
  const used = new Set<number>();
  let week = 0;

  while (out.length < targetCount && week < 26) {
    const base = startOfWeekMonday();
    base.setDate(base.getDate() + 7 * week);

    const hitsThisWeek = 3 + (Math.random() < 0.5 ? 0 : 1);
    const usedDays = new Set<number>();

    for (let i = 0; i < hitsThisWeek && out.length < targetCount; i++) {
      let day = randInt(0, 6);
      let guard = 0;
      while (usedDays.has(day) && guard++ < 10) day = randInt(0, 6);
      usedDays.add(day);

      const hour = randInt(9, 20);
      const minute = randInt(0, 11) * 5;

      const when = new Date(base);
      when.setDate(when.getDate() + day);
      when.setHours(hour, minute, 0, 0);

      if (when.getTime() <= Date.now()) continue;
      const key = when.getTime();
      if (used.has(key)) continue;
      used.add(key);
      out.push(when);
    }
    week++;
  }
  return out.sort((a, b) => a.getTime() - b.getTime());
}

/** Register + save Expo push token on the user's Firestore doc */
async function registerAndSaveExpoPushToken(uid: string) {
  try {
    if (!uid) return null;

    const { status } = await Notifications.getPermissionsAsync();
    const granted =
      status === 'granted'
        ? true
        : (await Notifications.requestPermissionsAsync()).status === 'granted';
    if (!granted) return null;

    const projectId =
      (Constants as any)?.expoConfig?.extra?.eas?.projectId ??
      (Constants as any)?.easConfig?.projectId;

    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;

    const userRef = doc(db, 'users', uid);
    await setDoc(
      userRef,
      { expoPushTokens: arrayUnion(token), lastPushTokenAt: serverTimestamp() },
      { merge: true }
    );

    return token;
  } catch {
    return null;
  }
}

/** Schedules/tops-up local “kindness nudge” notifications */
function useKindnessNudgesScheduler(userId: string | null | undefined) {
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!Device.isDevice) return;

      const perms = await Notifications.getPermissionsAsync();
      if (perms.status !== 'granted') {
        const req = await Notifications.requestPermissionsAsync();
        if (req.status !== 'granted') return;
      }

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Kindness nudges',
          importance: Notifications.AndroidImportance.DEFAULT,
          sound: 'default',
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
        }).catch(() => {});
      }

      const TARGET = 48;
      const existing = await Notifications.getAllScheduledNotificationsAsync();
      if (cancelled) return;

      const toAdd = Math.max(0, TARGET - existing.length);
      if (toAdd <= 0) return;

      const times = makeRandomWeeklyTriggers(toAdd);
      for (const when of times) {
        const prompt = NUDGE_PROMPTS[randInt(0, NUDGE_PROMPTS.length - 1)];
        await Notifications.scheduleNotificationAsync({
          content: { title: 'Make their day 💖', body: prompt, sound: false, data: { kind: 'lp:mtday' } },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: when,
            ...(Platform.OS === 'android' ? { channelId: 'default' } : null),
          } as any,
        });
        if (cancelled) return;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);
}

// ---------- ANDROID INTRO OVERLAY (show immediately; fade once nav is ready) ----------
const SPLASH_SOURCE = require('./assets/splash.png');
const _src = Image.resolveAssetSource(SPLASH_SOURCE) || { width: 320, height: 100 };
const SPLASH_AR = _src.width && _src.height ? _src.width / _src.height : 3.2;

export default function App() {
  const { user } = useAuthListener();

  // Always render overlay on Android; we'll fade it out later
  const [showIntro, setShowIntro] = useState(Platform.OS === 'android');
  const introOpacity = useRef(new Animated.Value(1)).current;
  const [navReady, setNavReady] = useState(false);

  // 🔑 KEY CHANGE: hide native (system) splash **immediately** on Android
  // so users don't sit on the small system/icon splash. Our overlay covers the gap.
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const t = setTimeout(() => {
      SplashScreen.hideAsync().catch(() => {});
    }, 10); // next tick after first render
    return () => clearTimeout(t);
  }, []);

  // iOS: hide native splash when navigation is ready
  useEffect(() => {
    if (Platform.OS === 'ios' && navReady) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [navReady]);

  // Fade out the Android overlay once navigation is ready
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    if (!navReady) return;
    Animated.timing(introOpacity, {
      toValue: 0,
      duration: 240,
      delay: 500,
      useNativeDriver: true,
    }).start(() => setShowIntro(false));
  }, [navReady, introOpacity]);

  // Global notifications handler
  useEffect(() => {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }) as any,
    });
  }, []);

  // Ensure common Android channels exist up front
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    (async () => {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'General',
        importance: Notifications.AndroidImportance.DEFAULT,
        sound: 'default',
        vibrationPattern: [0, 200, 200, 200],
        lightColor: '#FF231F7C',
      }).catch(() => {});
      await Notifications.setNotificationChannelAsync('reminders', {
        name: 'Reminders',
        importance: Notifications.AndroidImportance.DEFAULT,
        sound: 'default',
      }).catch(() => {});
      await Notifications.setNotificationChannelAsync('messages', {
        name: 'Messages',
        importance: Notifications.AndroidImportance.DEFAULT,
        sound: 'default',
      }).catch(() => {});
    })();
  }, []);

  // Save Expo push token whenever a user logs in (or changes)
  useEffect(() => {
    if (user?.uid) registerAndSaveExpoPushToken(user.uid);
  }, [user?.uid]);

  // Existing listeners/hooks
  usePartnerReminderListener(user?.uid ?? null);
  useKindnessNudgesScheduler(user?.uid ?? null);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <SpotlightProvider>
            <NavigationContainer onReady={() => setNavReady(true)}>
              {user ? <AppNavigator /> : <AuthNavigator />}
            </NavigationContainer>

            {/* Android post-splash overlay with a CENTERED, CONTAINED wordmark */}
            {showIntro && Platform.OS === 'android' && (
              <Animated.View style={[styles.splashOverlay, { opacity: introOpacity }]} pointerEvents="none">
                <Image source={SPLASH_SOURCE} resizeMode="contain" style={styles.splashWordmark} />
              </Animated.View>
            )}
          </SpotlightProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  splashOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  splashWordmark: {
    width: '72%',
    maxWidth: 420,
    aspectRatio: SPLASH_AR,
  },
});