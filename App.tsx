// App.tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationContainer } from '@react-navigation/native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  AppState,
  Easing,
  Image,
  LogBox,
  Platform,
  StyleSheet,
  View,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ConfettiProvider } from './components/ConfettiProvider';
import { ThemeProvider, useTokens } from './components/ThemeProvider';
import { SpotlightProvider } from './components/spotlight';
import useAuthListener from './hooks/useAuthListener';
import usePartnerReminderListener from './hooks/usePartnerReminderListener';
import AppNavigator from './navigation/AppNavigator';
import AuthNavigator from './navigation/AuthNavigator';

import { ensurePushSetup, migrateMyTokensToPublic } from './utils/push';

// Quiet known noisy logs without hiding real errors
LogBox.ignoreLogs([
  'setLayoutAnimationEnabledExperimental is currently a no-op in the New Architecture.',
  'Uncaught Error in snapshot listener:',
  'Missing or insufficient permissions.',
  "WebChannelConnection RPC 'Listen' stream",
]);

// Control native splash ourselves (we’ll hide it after nav is ready or via failsafe)
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

// YYYY-MM-DD key for “one per calendar day” logic
function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

// Best-effort read of a Date from an Expo NotificationRequest trigger
function extractTriggerDate(req: Notifications.NotificationRequest): Date | null {
  const trig: any = req.trigger;
  const raw = trig?.date ?? trig?.value ?? null;
  if (!raw) return null;
  try {
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

/* ---------- KINDNESS NUDGE IDENTIFICATION + KEYS ---------- */
const MTDAY_KIND = 'lp:mtday';
const LAST_MTDAY_KEY = 'lp:lastMtdayShown';
const LAST_MTDAY_UID_KEY = 'lp:lastMtdayUid';

const isMtdayTitle = (title?: string) => !!title && title.startsWith('Make their day');
function isMtdayRequest(req: Notifications.NotificationRequest) {
  const kind = (req?.content?.data as any)?.kind;
  const title = req?.content?.title as string | undefined;
  return kind === MTDAY_KIND || isMtdayTitle(title);
}

// Ensure 3–4 weekly hits, all on different days, and never clash with blockedDates
function makeRandomWeeklyTriggers(targetCount: number, blockedDates: Set<string> = new Set()): Date[] {
  const out: Date[] = [];
  const usedTimestamps = new Set<number>();
  let week = 0;

  while (out.length < targetCount && week < 52) {
    const base = startOfWeekMonday();
    base.setDate(base.getDate() + 7 * week);

    const hitsThisWeek = 3 + (Math.random() < 0.5 ? 0 : 1); // 3 or 4
    const usedDaysThisWeek = new Set<number>();

    for (let i = 0; i < hitsThisWeek && out.length < targetCount; i++) {
      let guard = 0;
      let day = randInt(0, 6);

      while (guard++ < 30) {
        if (!usedDaysThisWeek.has(day)) {
          const check = new Date(base);
          check.setDate(check.getDate() + day);
          const key = dateKey(check);
          if (!blockedDates.has(key)) break;
        }
        day = randInt(0, 6);
      }
      if (guard >= 30) continue;

      usedDaysThisWeek.add(day);

      const hour = randInt(9, 20);
      const minute = randInt(0, 11) * 5;

      const when = new Date(base);
      when.setDate(when.getDate() + day);
      when.setHours(hour, minute, 0, 0);

      if (when.getTime() <= Date.now()) {
        when.setDate(when.getDate() + 1);
      }

      const ts = when.getTime();
      const k = dateKey(when);
      if (usedTimestamps.has(ts) || blockedDates.has(k)) continue;

      usedTimestamps.add(ts);
      blockedDates.add(k);
      out.push(when);
    }

    week++;
  }
  return out.sort((a, b) => a.getTime() - b.getTime());
}

/** Schedules/tops-up local “kindness nudge” notifications (safe + cleans legacy) */
function useKindnessNudgesScheduler(userId: string | null | undefined) {
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!Device.isDevice) return;

        // permissions
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

        // --- ONE-TIME NORMALIZATION + ACCOUNT SWITCH CLEANUP ---
        const uidNow = userId ?? 'anon';
        const prevUid = (await AsyncStorage.getItem(LAST_MTDAY_UID_KEY)) ?? '';
        let all = await Notifications.getAllScheduledNotificationsAsync();
        if (cancelled) return;

        // Cancel "legacy" nudges that have the title but no kind
        for (const req of all) {
          const hasKind = (req?.content?.data as any)?.kind === MTDAY_KIND;
          const looksLikeNudge = isMtdayTitle(req?.content?.title as any);
          if (looksLikeNudge && !hasKind) {
            try { await Notifications.cancelScheduledNotificationAsync(req.identifier); } catch {}
          }
        }

        // If account changed, wipe ALL nudges for a clean per-account plan
        if (prevUid !== uidNow) {
          for (const req of all) {
            if (isMtdayRequest(req)) {
              try { await Notifications.cancelScheduledNotificationAsync(req.identifier); } catch {}
            }
          }
          await AsyncStorage.setItem(LAST_MTDAY_UID_KEY, uidNow);
          await AsyncStorage.removeItem(LAST_MTDAY_KEY); // allow one today if needed
        }

        // Refresh after cleanup
        all = await Notifications.getAllScheduledNotificationsAsync();

        // Only consider our nudges (title or kind)
        const nudgeRequests = all.filter(isMtdayRequest);

        // --- DEDUPE FUTURE DAYS (keep earliest per day) ---
        const byDay = new Map<string, Notifications.NotificationRequest[]>();
        for (const req of nudgeRequests) {
          const when = extractTriggerDate(req);
          if (!when || when.getTime() <= Date.now()) continue;
          const key = dateKey(when);
          const arr = byDay.get(key) ?? [];
          arr.push(req);
          byDay.set(key, arr);
        }
        for (const [, list] of byDay) {
          if (list.length <= 1) continue;
          list.sort((a, b) => {
            const da = extractTriggerDate(a)?.getTime() ?? 0;
            const db = extractTriggerDate(b)?.getTime() ?? 0;
            return da - db;
          });
          for (let i = 1; i < list.length; i++) {
            try { await Notifications.cancelScheduledNotificationAsync(list[i].identifier); } catch {}
          }
        }

        // Recompute after dedupe
        const stillScheduled = (await Notifications.getAllScheduledNotificationsAsync())
          .filter(isMtdayRequest)
          .filter((r) => {
            const when = extractTriggerDate(r);
            return !!when && when.getTime() > Date.now();
          });

        // Build blocked dates from remaining (unique) future nudge days
        const blockedDates = new Set<string>();
        for (const req of stillScheduled) {
          const when = extractTriggerDate(req)!;
          blockedDates.add(dateKey(when));
        }

        // Target stock: ~12 weeks @ 4/wk
        const TARGET = 48;
        const toAdd = Math.max(0, TARGET - stillScheduled.length);
        if (toAdd <= 0) return;

        const times = makeRandomWeeklyTriggers(toAdd, blockedDates);
        for (const when of times) {
          const prompt = NUDGE_PROMPTS[randInt(0, NUDGE_PROMPTS.length - 1)];
          await Notifications.scheduleNotificationAsync({
            content: {
              title: 'Make their day 💖',
              body: prompt,
              sound: false,
              data: { kind: MTDAY_KIND },
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: when,
              ...(Platform.OS === 'android' ? { channelId: 'default' } : null),
            } as any,
          });
          if (cancelled) return;
        }
      } catch {
        // never block first render
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);
}

// ---------- Splash assets / overlay ----------
const SPLASH_SOURCE = require('./assets/splash.png');
const _src = Image.resolveAssetSource(SPLASH_SOURCE) || { width: 320, height: 100 };
const SPLASH_AR = _src.width && _src.height ? _src.width / _src.height : 3.2;

/** Paint the bottom gesture/nav inset so Android doesn’t show strip artifacts over labels.
 *  IMPORTANT: this must render *behind* the navigator, so include it BEFORE <NavigationContainer/>.
 */
function BottomInsetBackground() {
  const insets = useSafeAreaInsets();
  const t = useTokens();
  if (Platform.OS !== 'android' || !insets.bottom) return null;
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: insets.bottom,
        backgroundColor: (t as any)?.colors?.card ?? '#FFFFFF',
      }}
    />
  );
}

export default function App() {
  const { user } = useAuthListener();

  const [showIntro, setShowIntro] = useState(true);
  const overlayOpacity = useRef(new Animated.Value(1)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const [navReady, setNavReady] = useState(false);
  const [introInDone, setIntroInDone] = useState(false);

  // Fade the logo in (~1s incl. hold)
  useEffect(() => {
    if (!showIntro) return;
    const id = requestAnimationFrame(() => {
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 550,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        const hold = setTimeout(() => setIntroInDone(true), 450);
        return () => clearTimeout(hold);
      });
    });
    return () => cancelAnimationFrame(id);
  }, [showIntro, logoOpacity]);

  // Fade overlay out once nav is ready + intro-in done
  useEffect(() => {
    if (!showIntro) return;
    if (!(navReady && introInDone)) return;
    Animated.timing(overlayOpacity, {
      toValue: 0,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => setShowIntro(false));
  }, [navReady, introInDone, showIntro, overlayOpacity]);

  // Hide native splash when nav is ready (or via failsafe below)
  useEffect(() => {
    if (!navReady) return;
    SplashScreen.hideAsync().catch(() => {});
  }, [navReady]);

  // Hard failsafe: never get stuck on a white overlay
  useEffect(() => {
    const t = setTimeout(() => {
      SplashScreen.hideAsync().catch(() => {});
      setShowIntro(false);
    }, 4000);
    return () => clearTimeout(t);
  }, []);

  // Global notifications handler with runtime day-dedupe
  useEffect(() => {
    Notifications.setNotificationHandler({
      handleNotification: async (n: Notifications.Notification) => {
        try {
          const kind = (n?.request?.content?.data as any)?.kind;
          const title = n?.request?.content?.title as string | undefined;

          if (kind === MTDAY_KIND || isMtdayTitle(title)) {
            const today = dateKey(new Date());
            const last = await AsyncStorage.getItem(LAST_MTDAY_KEY);
            if (last === today) {
              // swallow the 2nd nudge of the day
              return {
                shouldPlaySound: false,
                shouldSetBadge: false,
                shouldShowAlert: false as any,
                shouldShowBanner: false as any,
                shouldShowList: false as any,
              };
            }
            await AsyncStorage.setItem(LAST_MTDAY_KEY, today);
          }
        } catch {}
        return {
          shouldPlaySound: true,
          shouldSetBadge: false,
          shouldShowAlert: true as any,
          shouldShowBanner: true as any,
          shouldShowList: true as any,
        };
      },
    });
  }, []);

  // Android channels (non-blocking)
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    (async () => {
      try {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'General',
          importance: Notifications.AndroidImportance.DEFAULT,
          sound: 'default',
          vibrationPattern: [0, 200, 200, 200],
          lightColor: '#FF231F7C',
        });
        await Notifications.setNotificationChannelAsync('reminders', {
          name: 'Reminders',
          importance: Notifications.AndroidImportance.DEFAULT,
          sound: 'default',
        });
        await Notifications.setNotificationChannelAsync('messages', {
          name: 'Messages',
          importance: Notifications.AndroidImportance.DEFAULT,
          sound: 'default',
        });
      } catch {}
    })();
  }, []);

  // Save/refresh Expo push token on sign-in and when app becomes active
  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        if (user?.uid) {
          await ensurePushSetup(user.uid);
          await migrateMyTokensToPublic();
        }
      } catch (e) {
        console.warn('[push] ensurePushSetup failed:', e);
      }
    }
    run();

    const sub = AppState.addEventListener('change', (st) => {
      if (!cancelled && st === 'active' && user?.uid) run();
    });
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, [user?.uid]);

  // Existing listeners/hooks
  usePartnerReminderListener(user?.uid ?? null);
  useKindnessNudgesScheduler(user?.uid ?? null);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <ConfettiProvider>
            {/* Status bar: light background with dark icons */}
            <StatusBar style="dark" backgroundColor="#FFFFFF" />

            <SpotlightProvider>
              {/* 👇 render the inset background BEHIND the navigator */}
              <BottomInsetBackground />

              <NavigationContainer onReady={() => setNavReady(true)}>
                {user ? <AppNavigator /> : <AuthNavigator />}
              </NavigationContainer>

              {/* Fullscreen overlay (logo fades IN, overlay fades OUT) */}
              {showIntro && (
                <Animated.View
                  style={[styles.splashOverlay, { opacity: overlayOpacity }]}
                  pointerEvents="none"
                  renderToHardwareTextureAndroid
                  shouldRasterizeIOS
                >
                  <Animated.Image
                    source={SPLASH_SOURCE}
                    resizeMode="contain"
                    style={[styles.splashWordmark, { opacity: logoOpacity }]}
                  />
                </Animated.View>
              )}
            </SpotlightProvider>
          </ConfettiProvider>
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