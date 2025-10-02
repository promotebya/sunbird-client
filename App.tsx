// App.tsx
import { NavigationContainer } from '@react-navigation/native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ThemeProvider } from './components/ThemeProvider';
import { SpotlightProvider } from './components/spotlight'; // ⟵ NEW
import useAuthListener from './hooks/useAuthListener';
import usePartnerReminderListener from './hooks/usePartnerReminderListener';
import AppNavigator from './navigation/AppNavigator';
import AuthNavigator from './navigation/AuthNavigator';

// Show alerts when a notification fires in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// --- prompts (about 30) ---
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
  "Recall the moment you first felt close—tell them about it.",
  "Ask them about something they care about.",
  "Tell them one new thing you learned about them recently.",
  "Say: “I’m proud of you for ___.”",
  "Invite them for a 10-minute cuddle/check-in later.",
  "Send a heart + one word that describes them.",
  "Tell them why today you’re grateful for them.",
  "Ask: “What would you love to do together this weekend?”",
  "Say: “You looked great today because ___.”",
  "Text a quick pep talk—they deserve it!"
];

// Random helpers
const randInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

/** Monday of the week containing 'd' (local time) */
function startOfWeekMonday(d = new Date()) {
  const copy = new Date(d);
  const day = copy.getDay(); // 0..6 (Sun..Sat)
  const diffToMon = (day + 6) % 7; // 0=Mon
  copy.setHours(0, 0, 0, 0);
  copy.setDate(copy.getDate() - diffToMon);
  return copy;
}

/** Build a set of Date triggers: 3–4 per week between 9:00–21:00, for up to ~12 weeks */
function makeRandomWeeklyTriggers(targetCount: number): Date[] {
  const out: Date[] = [];
  const used = new Set<number>();
  let week = 0;

  while (out.length < targetCount && week < 26) {
    const base = startOfWeekMonday();
    base.setDate(base.getDate() + 7 * week);

    // 3 or 4 nudges this week
    const hitsThisWeek = 3 + (Math.random() < 0.5 ? 0 : 1);
    const usedDays = new Set<number>();

    for (let i = 0; i < hitsThisWeek && out.length < targetCount; i++) {
      // choose a unique day this week (0=Mon..6=Sun)
      let day = randInt(0, 6);
      let guard = 0;
      while (usedDays.has(day) && guard++ < 10) day = randInt(0, 6);
      usedDays.add(day);

      const hour = randInt(9, 20);        // 9:00 .. 20:59
      const minute = randInt(0, 11) * 5;  // minute in steps of 5 to avoid bunching

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

/** Schedules/tops-up local “kindness nudge” notifications */
function useKindnessNudgesScheduler(userId: string | null | undefined) {
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!Device.isDevice) return;
      // if (!userId) return; // enable if you only want nudges when logged in

      // Ask permission if needed
      const perms = await Notifications.getPermissionsAsync();
      if (perms.status !== 'granted') {
        const req = await Notifications.requestPermissionsAsync();
        if (req.status !== 'granted') return;
      }

      // Android channel
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Kindness nudges',
          importance: Notifications.AndroidImportance.DEFAULT
        });
      }

      // Keep ~48 future notifications queued (≈12 weeks @ 4/wk)
      const TARGET = 48;
      const existing = await Notifications.getAllScheduledNotificationsAsync();
      if (cancelled) return;

      const toAdd = Math.max(0, TARGET - existing.length);
      if (toAdd <= 0) return;

      const times = makeRandomWeeklyTriggers(toAdd);
      for (const when of times) {
        const prompt = NUDGE_PROMPTS[randInt(0, NUDGE_PROMPTS.length - 1)];
        const trigger: Notifications.DateTriggerInput = {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: when
        };
        await Notifications.scheduleNotificationAsync({
          content: { title: 'Make their day 💖', body: prompt, sound: false },
          trigger
        });
        if (cancelled) return;
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);
}

export default function App() {
  const { user } = useAuthListener();

  // existing hook
  usePartnerReminderListener(user?.uid ?? null);

  // schedule/tops-up the kindness nudges
  useKindnessNudgesScheduler(user?.uid ?? null);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          {/* Spotlight overlay needs to sit above everything */}
          <SpotlightProvider>
            <NavigationContainer>
              {user ? <AppNavigator /> : <AuthNavigator />}
            </NavigationContainer>
          </SpotlightProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}