// screens/RemindersScreen.tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  AppState,
  Dimensions,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from 'react-native';
import DateTimePickerModal from 'react-native-modal-datetime-picker';

import Button from '../components/Button';
import Card from '../components/Card';
import Screen from '../components/Screen';
import { SpotlightAutoStarter, SpotlightTarget, useSpotlight, type SpotlightStep } from '../components/spotlight';
import ThemedText from '../components/ThemedText';
import { useTokens, type ThemeTokens } from '../components/ThemeProvider';

import useAuthListener from '../hooks/useAuthListener';
import usePendingRemindersBadge from '../hooks/usePendingRemindersBadge';

import { getPairId, getPartnerUid } from '../utils/partner';
import {
  createPartnerReminderDoc,
  ensureNotificationPermission,
  formatLocalTime,
} from '../utils/reminders';

type SavedReq = Notifications.NotificationRequest;

/* ---------------- constants & helpers ---------------- */
const GENTLE_KIND = 'lp:nudge';
const ANDROID_CHANNEL_ID = 'reminders';
const YEARS_AHEAD = 5;
const DAY = 24 * 60 * 60 * 1000;

const HAIRLINE = '#F0E6EF';
const CHIP_BG = '#F3EEF6';

const selfIdsKey = (uid: string) => `reminders:self:${uid}`;

function withAlpha(hex: string, alpha: number) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function isGentleNudge(req: SavedReq): boolean {
  try { return (req?.content as any)?.data?.kind === GENTLE_KIND; } catch { return false; }
}

function isMakeTheirDay(req: SavedReq): boolean {
  try {
    const title = String(req?.content?.title ?? '');
    const body  = String(req?.content?.body ?? '');
    const kind  = (req?.content as any)?.data?.kind;
    if (/make\s+their\s+day/i.test(title) || /make\s+their\s+day/i.test(body)) return true;
    if (kind === 'lp:mtday' || kind === 'lp:suggest') return true;
  } catch {}
  return false;
}

function getTriggerType(trigger: any): 'calendar' | 'date' | 'timeInterval' | 'unknown' {
  try {
    if (!trigger) return 'unknown';
    const CAL  = Notifications.SchedulableTriggerInputTypes?.CALENDAR ?? 'calendar';
    const DATE = Notifications.SchedulableTriggerInputTypes?.DATE ?? 'date';
    const INT  = Notifications.SchedulableTriggerInputTypes?.TIME_INTERVAL ?? 'timeInterval';
    const t = (trigger as any).type ?? (
      (trigger as any).dateComponents ? CAL :
      (trigger as any).date ? DATE :
      (typeof (trigger as any).seconds === 'number' ? INT : 'unknown')
    );
    if (t === CAL || t === 'calendar') return 'calendar';
    if (t === DATE || t === 'date') return 'date';
    if (t === INT || t === 'timeInterval') return 'timeInterval';
    return 'unknown';
  } catch { return 'unknown'; }
}

// true yearly calendar (iOS)
function isYearlyCalendarTrigger(trigger: any): boolean {
  try {
    const ttype = getTriggerType(trigger);
    if (ttype !== 'calendar') return false;
    const comps = (trigger as any).dateComponents && typeof (trigger as any).dateComponents === 'object'
      ? (trigger as any).dateComponents
      : trigger;
    const hasMonth   = Number.isFinite(comps?.month);
    const hasDay     = Number.isFinite(comps?.day);
    const hasWeekday = Number.isFinite(comps?.weekday);
    return hasMonth && hasDay && !hasWeekday;
  } catch { return false; }
}

function nextOccurrence(month1to12: number, day: number, hour: number, minute: number) {
  const now = new Date();
  const year = now.getFullYear();
  let candidate = new Date(year, month1to12 - 1, day, hour, minute, 0, 0);
  if (candidate.getTime() <= now.getTime()) {
    candidate = new Date(year + 1, month1to12 - 1, day, hour, minute, 0, 0);
  }
  return candidate;
}

/* --- cancel this title’s series (local de-dupe before scheduling) --- */
async function cancelAnniversarySchedulesForTitle(matchTitle: string) {
  try {
    const items = await Notifications.getAllScheduledNotificationsAsync();
    const toCancel = items.filter((it) => {
      const kind = (it?.content as any)?.data?.kind;
      if (!kind || typeof kind !== 'string' || !kind.startsWith('lp:anniv:')) return false;
      const t1 = String(it?.content?.title ?? '').trim();
      const t2 = String((it?.content as any)?.data?.title ?? '').trim();
      if (t1 && t1.toLowerCase() === matchTitle.toLowerCase()) return true;
      if (t2 && t2.toLowerCase() === matchTitle.toLowerCase()) return true;
      const body = String(it?.content?.body ?? '');
      const m = body.match(/your\s+([^.!?]+?)(?:[.!?]|$)/i);
      const parsed = m?.[1]?.trim();
      return !!parsed && parsed.toLowerCase() === matchTitle.toLowerCase();
    });
    await Promise.allSettled(
      toCancel.map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier))
    );
  } catch {}
}

/* ---------------- scheduling (unchanged behavior, but we report IDs) ---------------- */
// iOS: true yearly repeats; report every scheduled id via onScheduled
async function scheduleIOSYearlyTriplet(
  params: { title: string; month: number; day: number; hour: number; minute: number },
  onScheduled?: (id: string) => void | Promise<void>
) {
  const { title, month, day, hour, minute } = params;
  const base = { repeats: true, type: Notifications.SchedulableTriggerInputTypes.CALENDAR } as const;

  const id1 = await Notifications.scheduleNotificationAsync({
    content: { title, body: `It's today! 💞 Did you plan something?`, data: { kind: 'lp:anniv:today', title } },
    trigger: { ...base, month, day, hour, minute } as any,
  });
  onScheduled?.(id1);

  const d1 = new Date(2000, month - 1, day); d1.setDate(d1.getDate() - 1);
  const id2 = await Notifications.scheduleNotificationAsync({
    content: { title, body: `Tomorrow is your ${title}. A tiny plan goes a long way ✨`, data: { kind: 'lp:anniv:d1', title } },
    trigger: { ...base, month: d1.getMonth() + 1, day: d1.getDate(), hour, minute } as any,
  });
  onScheduled?.(id2);

  const d7 = new Date(2000, month - 1, day); d7.setDate(d7.getDate() - 7);
  const id3 = await Notifications.scheduleNotificationAsync({
    content: { title, body: `One week until your ${title}! Want ideas?`, data: { kind: 'lp:anniv:d7', title } },
    trigger: { ...base, month: d7.getMonth() + 1, day: d7.getDate(), hour, minute } as any,
  });
  onScheduled?.(id3);
}

// Android: pre-schedule N future years as date alarms; report IDs
async function scheduleAndroidForYears(
  params: { title: string; month: number; day: number; hour: number; minute: number; years: number },
  onScheduled?: (id: string) => void | Promise<void>
) {
  const { title, month, day, hour, minute, years } = params;

  const first = nextOccurrence(month, day, hour, minute).getFullYear();
  const mkDateTrigger = (d: Date): Notifications.DateTriggerInput => ({
    type: Notifications.SchedulableTriggerInputTypes.DATE,
    date: d,
    channelId: ANDROID_CHANNEL_ID,
  } as any);

  for (let y = 0; y < years; y++) {
    const year = first + y;

    const due = new Date(year, month - 1, day, hour, minute, 0, 0);
    const d1  = new Date(due.getTime() - DAY);
    const d7  = new Date(due.getTime() - 7 * DAY);

    const id1 = await Notifications.scheduleNotificationAsync({
      content: { title, body: `It's today! 💞 Did you plan something?`, data: { kind: 'lp:anniv:today', year, title } },
      trigger: mkDateTrigger(due),
    });
    onScheduled?.(id1);

    const id2 = await Notifications.scheduleNotificationAsync({
      content: { title, body: `Tomorrow is your ${title}. A tiny plan goes a long way ✨`, data: { kind: 'lp:anniv:d1', year, title } },
      trigger: mkDateTrigger(d1),
    });
    onScheduled?.(id2);

    const id3 = await Notifications.scheduleNotificationAsync({
      content: { title, body: `One week until your ${title}! Want ideas?`, data: { kind: 'lp:anniv:d7', year, title } },
      trigger: mkDateTrigger(d7),
    });
    onScheduled?.(id3);
  }
}

async function scheduleYearlyTriplet(
  params: { title: string; month: number; day: number; hour: number; minute: number },
  onScheduled?: (id: string) => void | Promise<void>
) {
  if (Platform.OS === 'ios') return scheduleIOSYearlyTriplet(params, onScheduled);
  return scheduleAndroidForYears({ ...params, years: YEARS_AHEAD }, onScheduled);
}

/* ---------------- UI (screen) ---------------- */
// removed the "rem-toggle" tutorial step per request
const REMINDERS_TOUR_STEPS: SpotlightStep[] = [
  { id: 'rem-welcome', targetId: null, title: 'Reminders', text: "Set yearly dates and we'll handle the nudges for you.", placement: 'bottom', allowBackdropTapToNext: true },
  { id: 'rem-title',  targetId: 'rem-title',  title: 'Title', text: 'Pick a title or use a preset.' },
  { id: 'rem-date',   targetId: 'rem-date',   title: 'Date',  text: 'Choose the day and month.' },
  { id: 'rem-time',   targetId: 'rem-time',   title: 'Time',  text: 'Pick when the reminder should appear.' },
  { id: 'rem-inbox',  targetId: 'rem-inbox',  title: 'Inbox', text: 'See pending partner items and your upcoming reminders here.' },
];

const RemindersScreen: React.FC = () => {
  const t = useTokens();
  const s = useMemo(() => styles(t), [t]);
  const navigation = useNavigation<any>();
  const { user } = useAuthListener();

  // spotlight helpers
  const scrollRef = React.useRef<ScrollView>(null);
  const saveRef = React.useRef<any>(null);
  const [scrollY, setScrollY] = useState(0);

  const { steps: activeSteps, stepIndex, isActive } = useSpotlight();
  const currentStepId = isActive && activeSteps?.[stepIndex]?.id ? activeSteps![stepIndex]!.id : null;

  function ensureVisible(ref: React.RefObject<View>) {
    const node = ref.current as any;
    if (!node || !scrollRef.current) return;
    node.measureInWindow((x: number, y: number, w: number, h: number) => {
      const H = Dimensions.get('window').height;
      const topMargin = 140;
      const bottomMargin = 280;
      let nextY = scrollY;
      if (y < topMargin) nextY = Math.max(0, scrollY - (topMargin - y));
      else if (y + h > H - bottomMargin) nextY = scrollY + ((y + h) - (H - bottomMargin));
      else return;
      scrollRef.current?.scrollTo({ y: nextY, animated: true });
    });
  }

  useEffect(() => {
    if (!currentStepId) return;
    const map: Record<string, React.RefObject<View>> = { 'rem-save': saveRef };
    const r = map[currentStepId];
    if (r) setTimeout(() => ensureVisible(r), 50);
  }, [currentStepId]);

  const [pairId, setPairId] = useState<string | null>(null);
  const [partnerUid, setPartnerUid] = useState<string | null>(null);

  const [title, setTitle] = useState('Anniversary');
  const [dateOnly, setDateOnly] = useState<Date | null>(null);
  const [timeOnly, setTimeOnly] = useState<Date | null>(null);

  const [forBoth, setForBoth] = useState(false);

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const [banner, setBanner] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [scheduled, setScheduled] = useState<SavedReq[]>([]);
  const [loadingScheduled, setLoadingScheduled] = useState(false);

  // Only show locally-created reminders in Saved
  const [selfIds, setSelfIds] = useState<Set<string>>(new Set());

  const { badge } = usePendingRemindersBadge(user?.uid ?? null);

  // --- fresh pairing: reliable state refresh + heartbeat poll ---
  const pairPollRef = useRef<any>(null);

  const refreshPairState = useCallback(async () => {
    if (!user?.uid) {
      setPairId(null);
      setPartnerUid(null);
      return { pid: null as string | null, puid: null as string | null };
    }
    try {
      const [pid, puid] = await Promise.all([getPairId(user.uid), getPartnerUid(user.uid)]);
      const nextPid = pid ?? null;
      const nextPuid = puid ?? null;
      setPairId(nextPid);
      setPartnerUid(nextPuid);
      return { pid: nextPid, puid: nextPuid };
    } catch {
      return { pid: null, puid: null };
    }
  }, [user?.uid]);

  useEffect(() => {
    // initial load
    refreshPairState();
    // short heartbeat: every 4s, up to ~2 minutes, stops early when both present
    if (pairPollRef.current) clearInterval(pairPollRef.current);
    let tries = 0;
    pairPollRef.current = setInterval(async () => {
      tries++;
      const { pid, puid } = await refreshPairState();
      if ((pid && puid) || tries >= 30) {
        clearInterval(pairPollRef.current);
        pairPollRef.current = null;
      }
    }, 4000);
    return () => {
      if (pairPollRef.current) clearInterval(pairPollRef.current);
      pairPollRef.current = null;
    };
  }, [refreshPairState]);

  useFocusEffect(
    useCallback(() => {
      refreshPairState();
      return () => {};
    }, [refreshPairState])
  );

  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') refreshPairState();
    });
    return () => sub.remove();
  }, [refreshPairState]);

  // load local scheduled + selfIds and prune
  useEffect(() => {
    (async () => {
      if (!user) return;
      // load self ids for this user
      try {
        const raw = await AsyncStorage.getItem(selfIdsKey(user.uid));
        if (raw) setSelfIds(new Set(JSON.parse(raw)));
      } catch {}
    })();
  }, [user]);

  const canCreateForBoth = useMemo(() => !!partnerUid && !!pairId, [partnerUid, pairId]);

  // Android: ensure channel
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
      name: 'Reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    }).catch(() => {});
  }, []);

  // Notification handler
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

  const dateLabel = dateOnly
    ? dateOnly.toLocaleDateString(undefined, { day: 'numeric', month: 'long' })
    : 'Select date…';
  const timeLabel = timeOnly ? formatLocalTime(timeOnly) : 'Select time…';

  function ensureHasDefaults() {
    if (!dateOnly) setDateOnly(new Date());
    if (!timeOnly) setTimeOnly(new Date(2000, 0, 1, 9, 0));
  }

  /* ---------- functional updates to avoid lost IDs ---------- */
  const updateSelfIds = useCallback((updater: (prev: Set<string>) => Set<string>) => {
    if (!user?.uid) return;
    setSelfIds(prev => {
      const next = updater(prev);
      AsyncStorage.setItem(selfIdsKey(user.uid!), JSON.stringify(Array.from(next))).catch(() => {});
      return next;
    });
  }, [user?.uid]);

  const addSelfId = useCallback((id: string) => {
    updateSelfIds(prev => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, [updateSelfIds]);

  const removeSelfId = useCallback((id: string) => {
    updateSelfIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, [updateSelfIds]);

  // Load OS scheduled + prune selfIds to existing ones (functional to avoid races)
  const loadScheduled = useCallback(async () => {
    setLoadingScheduled(true);
    try {
      const items = await Notifications.getAllScheduledNotificationsAsync();
      setScheduled(items);

      // prune IDs that no longer exist
      if (user?.uid) {
        const exist = new Set(items.map(i => i.identifier));
        updateSelfIds(prev => {
          const next = new Set(Array.from(prev).filter(id => exist.has(id)));
          return next;
        });
      }
    } finally {
      setLoadingScheduled(false);
    }
  }, [updateSelfIds, user?.uid]);

  useEffect(() => { loadScheduled(); }, [loadScheduled]);
  useFocusEffect(useCallback(() => { loadScheduled(); }, [loadScheduled]));

  // Robust title resolver for Saved list (still useful for display)
  const getReqTitle = useCallback((req: SavedReq) => {
    const direct = String(req?.content?.title ?? '').trim();
    if (direct && direct.toLowerCase() !== 'reminder') return direct;
    const dataTitle = String((req?.content as any)?.data?.title ?? '').trim();
    if (dataTitle) return dataTitle;
    const body = String(req?.content?.body ?? '');
    const m = body.match(/your\s+([^.!?]+?)(?:[.!?]|$)/i);
    if (m?.[1]) return m[1].trim();
    return 'Reminder';
  }, []);

  // Show only *my* locally-created reminders in Saved
  const visibleScheduled = useMemo((): SavedReq[] => {
    const mine = scheduled.filter((req) => selfIds.has(req.identifier));
    const filtered = mine.filter((req) => !isGentleNudge(req) && !isMakeTheirDay(req));
    const out: SavedReq[] = [];
    const seen = new Set<string>();
    for (const req of filtered) {
      const kind = (req?.content as any)?.data?.kind ?? 'lp:anniv:today';
      if (kind === 'lp:anniv:d1' || kind === 'lp:anniv:d7') continue;
      const key = `${getReqTitle(req)}||${kind}`;
      if (!seen.has(key)) {
        seen.add(key);
        out.push(req);
      }
    }
    return out;
  }, [scheduled, selfIds, getReqTitle]);

  function triggerToText(trigger: any, req?: SavedReq): string {
    try {
      if (!trigger) return 'Scheduled';
      const CAL  = Notifications.SchedulableTriggerInputTypes?.CALENDAR ?? 'calendar';
      const DATE = Notifications.SchedulableTriggerInputTypes?.DATE ?? 'date';
      const INT  = Notifications.SchedulableTriggerInputTypes?.TIME_INTERVAL ?? 'timeInterval';
      const t = (trigger as any).type ?? (
        (trigger as any).dateComponents ? CAL :
        (trigger as any).date ? DATE :
        (typeof (trigger as any).seconds === 'number' ? INT : undefined)
      );

      const markYearly = String((req?.content as any)?.data?.kind ?? '').startsWith('lp:anniv:');

      if (t === CAL || t === 'calendar') {
        const comps = (trigger as any).dateComponents && typeof (trigger as any).dateComponents === 'object'
          ? (trigger as any).dateComponents
          : trigger;
        const month  = Number.isFinite(comps?.month)  ? comps.month  : 1;
        const day    = Number.isFinite(comps?.day)    ? comps.day    : 1;
        const hour   = Number.isFinite(comps?.hour)   ? comps.hour   : 0;
        const minute = Number.isFinite(comps?.minute) ? comps.minute : 0;
        const when = new Date(2000, month - 1, day, hour, minute, 0, 0);
        let md = '';
        try { md = when.toLocaleDateString([], { month: 'long', day: 'numeric' }); }
        catch { md = `${month}/${day}`; }
        const hm = formatLocalTime(when);
        return `${md} • ${hm} • yearly`;
      }

      if (t === DATE || t === 'date') {
        const raw = (trigger as any).date;
        const d = raw ? new Date(raw) : null;
        if (d && !isNaN(d.getTime())) {
          let dd = '';
          try { dd = d.toLocaleDateString([], { year: 'numeric', month: 'long', day: 'numeric' }); }
          catch { dd = `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`; }
          return `${dd} • ${formatLocalTime(d)}${markYearly ? ' • yearly' : ''}`;
        }
        return 'Scheduled date';
      }

      if (t === INT || t === 'timeInterval') {
        const secs = Number((trigger as any).seconds ?? 0);
        if (secs > 0) {
          const when = new Date(Date.now() + secs * 1000);
          let dd = '';
          try { dd = when.toLocaleDateString([], { month: 'long', day: 'numeric' }); }
          catch { dd = `${when.getMonth() + 1}/${when.getDate()}/${when.getFullYear()}`; }
          return `${dd} • ${formatLocalTime(when)}${markYearly ? ' • yearly' : ''}`;
        }
        return 'Scheduled';
      }

      return 'Scheduled';
    } catch { return 'Scheduled'; }
  }

  async function onCancel(id: string) {
    await Notifications.cancelScheduledNotificationAsync(id);
    removeSelfId(id);
    await loadScheduled();
  }

  // single source of truth for toggling the "for both" state
  const toggleForBoth = useCallback(() => {
    if (!canCreateForBoth) {
      Alert.alert(
        'Link accounts first',
        'Open Pairing to link with your partner before sharing reminders.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Pairing', onPress: () => {
              try { navigation.navigate('Pairing' as never); } catch {}
              try { navigation.getParent?.()?.navigate('Settings', { screen: 'Pairing' }); } catch {}
            } 
          },
        ]
      );
      return;
    }
    setForBoth(v => !v);
  }, [canCreateForBoth, navigation]);

  async function onSave() {
    if (!user) return;
    if (!dateOnly || !timeOnly) {
      Alert.alert('Choose date & time', 'Please pick both a date and time.');
      return;
    }

    const granted = await ensureNotificationPermission();
    if (!granted) {
      Alert.alert('Enable notifications', 'Notifications are disabled for this app. Please enable them in Settings to schedule reminders.');
      return;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
        name: 'Reminders',
        importance: Notifications.AndroidImportance.DEFAULT,
        sound: 'default',
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      }).catch(() => {});
    }

    // 🔄 First-run pairing race guard: if “for both” is ON but state isn’t ready yet, refresh once
    if (forBoth && (!pairId || !partnerUid)) {
      const { pid, puid } = await refreshPairState();
      if (!pid || !puid) {
        Alert.alert('Linking not finished yet', 'Give it a moment after linking, then try again—or open Pairing once.');
        return;
      }
    }

    setSaving(true);
    try {
      const month = dateOnly.getMonth() + 1;
      const day   = dateOnly.getDate();
      const hour  = timeOnly.getHours();
      const minute= timeOnly.getMinutes();

      // de-dupe only this event series
      await cancelAnniversarySchedulesForTitle(title);

      // local schedule (report ids so Saved shows only mine)
      await scheduleYearlyTriplet({ title, month, day, hour, minute }, addSelfId);

      // partner doc
      if (forBoth && pairId && partnerUid) {
        const dueAt = nextOccurrence(month, day, hour, minute);
        await createPartnerReminderDoc({ forUid: partnerUid, ownerId: user.uid, pairId, title, dueAt });
      }

      setBanner('Reminders saved ✨');
      setTimeout(() => setBanner(null), 1800);

      await new Promise((r) => setTimeout(r, 800));
      await loadScheduled();
    } catch (e: any) {
      Alert.alert('Could not schedule', e?.message ?? 'Please try again.');
    } finally {
      setSaving(false);
    }
  }

  const fixedSummary = `We’ll remind you 7 days before, 1 day before, and on the day${
    timeOnly ? ` at ${formatLocalTime(timeOnly)}` : ''
  } — every year until you cancel.`;

  function openInbox() {
    try { navigation.navigate('RemindersInbox' as never); } catch {}
    try { navigation.getParent?.()?.navigate('Reminders', { screen: 'RemindersInbox' }); } catch {}
  }

  return (
    <Screen keyboard>
      <ScrollView
        ref={scrollRef}
        onScroll={(e) => setScrollY(e.nativeEvent.contentOffset.y)}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        {/* header */}
        <View style={s.headerRow}>
          <ThemedText variant="display">Anniversary</ThemedText>
          <SpotlightTarget id="rem-inbox">
            <Button label={badge ? `Inbox  ${badge}` : 'Inbox'} variant="outline" onPress={openInbox} />
          </SpotlightTarget>
        </View>

        <ThemedText variant="subtitle" color={t.colors.textDim} style={{ marginBottom: t.spacing.md }}>
          Yearly reminders—set once, we’ll take care of the nudges.
        </ThemedText>

        {/* title + presets */}
        <Card>
          <ThemedText variant="h2" style={{ marginBottom: t.spacing.s }}>Title</ThemedText>
          <SpotlightTarget id="rem-title">
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Anniversary"
              placeholderTextColor={t.colors.textDim}
              style={s.input}
              onFocus={ensureHasDefaults}
            />
          </SpotlightTarget>
          <View style={s.rowWrap}>
            {['Anniversary', 'First Date', 'Engagement Day', 'Wedding Day'].map((name) => (
              <Pressable key={name} onPress={() => setTitle(name)} accessibilityRole="button" style={s.pill}>
                <ThemedText variant="label">{name}</ThemedText>
              </Pressable>
            ))}
          </View>
        </Card>

        {/* date/time + toggle + save */}
        <Card style={{ marginTop: t.spacing.md }}>
          <ThemedText variant="h2">Date</ThemedText>
          <SpotlightTarget id="rem-date">
            <Pressable onPress={() => { ensureHasDefaults(); setShowDatePicker(true); }} style={s.input} accessibilityRole="button">
              <ThemedText variant="body" color={dateOnly ? t.colors.text : t.colors.textDim}>{dateLabel}</ThemedText>
            </Pressable>
          </SpotlightTarget>

          <ThemedText variant="h2" style={{ marginTop: t.spacing.md }}>Time</ThemedText>
          <SpotlightTarget id="rem-time">
            <Pressable onPress={() => { ensureHasDefaults(); setShowTimePicker(true); }} style={s.input} accessibilityRole="button">
              <ThemedText variant="body" color={timeOnly ? t.colors.text : t.colors.textDim}>{timeLabel}</ThemedText>
            </Pressable>
          </SpotlightTarget>

          <ThemedText variant="caption" color={t.colors.textDim} style={{ marginTop: t.spacing.s }}>
            {fixedSummary}
          </ThemedText>

          {/* Toggle row – press anywhere to toggle */}
          <Pressable
            onPress={toggleForBoth}
            accessibilityRole="switch"
            accessibilityState={{ checked: forBoth, disabled: !canCreateForBoth }}
            style={[s.toggleRow, { marginTop: t.spacing.md }]}
            hitSlop={8}
          >
            <ThemedText variant="body">Also create for partner</ThemedText>
            <Switch
              value={forBoth}
              onValueChange={toggleForBoth}
              disabled={!canCreateForBoth}
              trackColor={{ false: withAlpha(t.colors.text, 0.15), true: withAlpha(t.colors.primary, 0.4) }}
              thumbColor={Platform.OS === 'android' ? (forBoth ? t.colors.primary : '#f4f3f4') : undefined}
              ios_backgroundColor={withAlpha(t.colors.text, 0.15)}
              style={{ marginLeft: 8 }}
            />
          </Pressable>

          <View style={s.rowDivider} />

          <View ref={saveRef} style={{ marginTop: t.spacing.s }}>
            <SpotlightTarget id="rem-save">
              <View>
                <Button label={saving ? 'Saving…' : 'Save reminders'} onPress={onSave} disabled={saving} />
              </View>
            </SpotlightTarget>
          </View>
        </Card>

        {/* saved reminders */}
        <Card style={{ marginTop: t.spacing.md }}>
          <View style={s.savedHeader}>
            <ThemedText variant="h2">Saved reminders</ThemedText>
            <Button label={loadingScheduled ? 'Loading…' : 'Refresh'} variant="outline" onPress={loadScheduled} />
          </View>

        {visibleScheduled.length === 0 ? (
          <ThemedText variant="caption" color={t.colors.textDim}>No local reminders yet.</ThemedText>
        ) : (
          <View style={{ rowGap: 10 }}>
            {visibleScheduled.map((req) => (
              <View key={req.identifier} style={s.savedRow}>
                <View style={{ flex: 1 }}>
                  <ThemedText variant="title">{getReqTitle(req)}</ThemedText>
                  <ThemedText variant="caption" color={t.colors.textDim} style={{ marginTop: 2 }}>
                    {triggerToText((req as any).trigger, req)}
                  </ThemedText>
                </View>
                <Pressable onPress={() => onCancel(req.identifier)} style={s.cancelBtn} accessibilityRole="button">
                  <ThemedText variant="label" color="#fff">Cancel</ThemedText>
                </Pressable>
              </View>
            ))}
          </View>
        )}
        </Card>

        {/* pickers */}
        <DateTimePickerModal
          isVisible={showDatePicker}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          date={dateOnly ?? new Date()}
          onConfirm={(d: Date) => { setDateOnly(d); setShowDatePicker(false); }}
          onCancel={() => setShowDatePicker(false)}
          textColor={t.colors.text}
          themeVariant="light"
          pickerContainerStyleIOS={{ backgroundColor: '#FFFFFF' }}
        />
        <DateTimePickerModal
          isVisible={showTimePicker}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          date={timeOnly ?? new Date(2000, 0, 1, 9, 0)}
          onConfirm={(d: Date) => { setTimeOnly(d); setShowTimePicker(false); }}
          onCancel={() => setShowTimePicker(false)}
          textColor={t.colors.text}
          themeVariant="light"
          pickerContainerStyleIOS={{ backgroundColor: '#FFFFFF' }}
        />

        {banner ? (
          <View style={s.toast}>
            <ThemedText variant="button" color="#fff" center>{banner}</ThemedText>
          </View>
        ) : null}
        <SpotlightAutoStarter uid={user?.uid ?? null} steps={REMINDERS_TOUR_STEPS} persistKey="tour-reminders" />
      </ScrollView>
    </Screen>
  );
};

const styles = (t: ThemeTokens) =>
  StyleSheet.create({
    headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: t.spacing.s },
    input: {
      minHeight: 44, paddingVertical: t.spacing.s, paddingHorizontal: t.spacing.md,
      backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: HAIRLINE,
      color: t.colors.text, marginTop: t.spacing.s, justifyContent: 'center',
    },
    rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: t.spacing.s },
    pill: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, backgroundColor: CHIP_BG, borderWidth: 1, borderColor: HAIRLINE },
    rowDivider: { height: StyleSheet.hairlineWidth, backgroundColor: HAIRLINE, marginVertical: t.spacing.md },
    toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    savedHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: t.spacing.s },
    savedRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    cancelBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: '#EF4444' },
    toast: { position: 'absolute', left: t.spacing.md, right: t.spacing.md, bottom: t.spacing.xl, backgroundColor: '#111827', padding: t.spacing.md, borderRadius: t.radius.lg },
  });

export default RemindersScreen;