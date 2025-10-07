// screens/RemindersScreen.tsx
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
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
  scheduleYearlyNotification,
} from '../utils/reminders';

type SavedReq = Notifications.NotificationRequest;

// classification helpers
const GENTLE_KIND = 'lp:nudge';
function isGentleNudge(req: SavedReq): boolean {
  try { return (req?.content as any)?.data?.kind === GENTLE_KIND; } catch { return false; }
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

// spotlight tour
const REMINDERS_TOUR_STEPS: SpotlightStep[] = [
  { id: 'rem-welcome', targetId: null, title: 'Reminders', text: "Set yearly dates and we'll handle the nudges for you.", placement: 'bottom', allowBackdropTapToNext: true },
  { id: 'rem-title',  targetId: 'rem-title',  title: 'Title', text: 'Pick a title or use a preset.' },
  { id: 'rem-date',   targetId: 'rem-date',   title: 'Date',  text: 'Choose the day and month.' },
  { id: 'rem-time',   targetId: 'rem-time',   title: 'Time',  text: 'Pick when the reminder should appear.' },
  { id: 'rem-toggle', targetId: 'rem-toggle', title: 'For both', text: 'Switch this on to also add the reminder to your partner’s screen.', placement: 'top' },
  { id: 'rem-inbox',  targetId: 'rem-inbox',  title: 'Inbox', text: 'See pending partner items and your upcoming reminders here.' },
];

// palette
const HAIRLINE = '#F0E6EF';
const CHIP_BG = '#F3EEF6';

// rgba helper (keeps your theme behavior)
function withAlpha(hex: string, alpha: number) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// hide “Make their day” from Saved
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

// only real yearly calendar (iOS)
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

// ---------- Android scheduling helpers ----------
const ANDROID_CHANNEL_ID = 'reminders';
const DAY = 24 * 60 * 60 * 1000;

function nextOccurrence(month1to12: number, day: number, hour: number, minute: number) {
  const now = new Date();
  const year = now.getFullYear();
  let candidate = new Date(year, month1to12 - 1, day, hour, minute, 0, 0);
  if (candidate.getTime() <= now.getTime()) {
    candidate = new Date(year + 1, month1to12 - 1, day, hour, minute, 0, 0);
  }
  return candidate;
}

// Cancel previous anniversary schedules so we don't stack/duplicate
async function cancelExistingAnniversarySchedules() {
  try {
    const items = await Notifications.getAllScheduledNotificationsAsync();
    const toCancel = items.filter((it) => {
      const kind = (it?.content as any)?.data?.kind;
      return typeof kind === 'string' && kind.startsWith('lp:anniv:');
    });
    await Promise.allSettled(
      toCancel.map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier))
    );
  } catch {}
}

// ANDROID: correct Date trigger (no extra fields on trigger), ensure > 65s in the future
async function scheduleAndroidDate(
  content: Notifications.NotificationContentInput,
  when: Date
) {
  let target = when.getTime();
  const now = Date.now();
  if (target - now < 65_000) target = now + 65_000; // avoid “fire now”

  const id = await Notifications.scheduleNotificationAsync({
    content,
    trigger: {
      date: new Date(target),
      channelId: ANDROID_CHANNEL_ID,
    } as Notifications.DateTriggerInput,
  });
  return id;
}

async function scheduleAndroidYearlyTriplet(params: {
  title: string;
  month: number;
  day: number;
  hour: number;
  minute: number;
}) {
  const { title, month, day, hour, minute } = params;

  const now = new Date();
  const dueAt = nextOccurrence(month, day, hour, minute);
  const nextYearSame = new Date(dueAt.getFullYear() + 1, month - 1, day, hour, minute, 0, 0);

  const d1 = new Date(dueAt.getTime() - DAY);
  const d7 = new Date(dueAt.getTime() - 7 * DAY);

  const d1Final = d1 > now ? d1 : new Date(nextYearSame.getTime() - DAY);
  const d7Final = d7 > now ? d7 : new Date(nextYearSame.getTime() - 7 * DAY);

  await scheduleAndroidDate(
    { title, body: `It's today! 💞 Did you plan something?`, data: { kind: 'lp:anniv:today' } },
    dueAt
  );
  await scheduleAndroidDate(
    { title, body: `Tomorrow is your ${title}. A tiny plan goes a long way ✨`, data: { kind: 'lp:anniv:d1' } },
    d1Final
  );
  await scheduleAndroidDate(
    { title, body: `One week until your ${title}! Want ideas?`, data: { kind: 'lp:anniv:d7' } },
    d7Final
  );
}

const RemindersScreen: React.FC = () => {
  const t = useTokens();
  const s = useMemo(() => styles(t), [t]);
  const navigation = useNavigation<any>();
  const { user } = useAuthListener();

  // spotlight helpers
  const scrollRef = React.useRef<ScrollView>(null);
  const toggleRef = React.useRef<any>(null);
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
    const map: Record<string, React.RefObject<View>> = { 'rem-toggle': toggleRef, 'rem-save': saveRef };
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

  const { badge } = usePendingRemindersBadge(user?.uid ?? null);

  useEffect(() => {
    (async () => {
      if (!user) return;
      const [pid, puid] = await Promise.all([getPairId(user.uid), getPartnerUid(user.uid)]);
      setPairId(pid);
      setPartnerUid(puid);
    })();
  }, [user]);

  const canCreateForBoth = useMemo(() => !!partnerUid && !!pairId, [partnerUid, pairId]);

  // Android: make sure channel exists
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

  const dateLabel = dateOnly
    ? dateOnly.toLocaleDateString(undefined, { day: 'numeric', month: 'long' })
    : 'Select date…';
  const timeLabel = timeOnly ? formatLocalTime(timeOnly) : 'Select time…';

  function ensureHasDefaults() {
    if (!dateOnly) setDateOnly(new Date());
    if (!timeOnly) setTimeOnly(new Date(2000, 0, 1, 9, 0));
  }

  const loadScheduled = useCallback(async () => {
    setLoadingScheduled(true);
    try {
      const items = await Notifications.getAllScheduledNotificationsAsync();
      items.sort((a, b) => {
        const ta = a.content?.title ?? '';
        const tb = b.content?.title ?? '';
        if (ta !== tb) return ta.localeCompare(tb);
        const sa = triggerToText((a as any).trigger);
        const sb = triggerToText((b as any).trigger);
        return sa.localeCompare(sb);
      });
      setScheduled(items);
    } finally {
      setLoadingScheduled(false);
    }
  }, []);

  useEffect(() => { loadScheduled(); }, [loadScheduled]);
  useFocusEffect(useCallback(() => { loadScheduled(); }, [loadScheduled]));

  const visibleScheduled = useMemo((): SavedReq[] => {
    const unique = new Map<string, SavedReq>();
    for (const req of scheduled) {
      if (isGentleNudge(req)) continue;
      if (isMakeTheirDay(req)) continue;

      const trig = (req as any).trigger;
      const ttype = getTriggerType(trig);

      // iOS: keep only true yearly calendar (month+day); Android: date/timeInterval are fine
      if (ttype === 'calendar' && !isYearlyCalendarTrigger(trig)) continue;

      const key = `${req.content?.title ?? ''}||${triggerToText(trig)}||${(req.content as any)?.data?.kind ?? ''}`;
      if (!unique.has(key)) unique.set(key, req);
    }
    return Array.from(unique.values());
  }, [scheduled]);

  function triggerToText(trigger: any): string {
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
          try { dd = d.toLocaleDateString(); }
          catch { dd = `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`; }
          return `${dd} • ${formatLocalTime(d)}`;
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
          return `${dd} • ${formatLocalTime(when)}`;
        }
        return 'Scheduled';
      }

      return 'Scheduled';
    } catch { return 'Scheduled'; }
  }

  async function onCancel(id: string) {
    await Notifications.cancelScheduledNotificationAsync(id);
    await loadScheduled();
  }

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

    setSaving(true);
    try {
      const baseMonth = dateOnly.getMonth() + 1;
      const baseDay = dateOnly.getDate();
      const hour = timeOnly.getHours();
      const minute = timeOnly.getMinutes();

      // avoid duplicates/bursts
      await cancelExistingAnniversarySchedules();

      if (Platform.OS === 'android') {
        // schedule 3 separate date alarms (future-proofed)
        await scheduleAndroidYearlyTriplet({ title, month: baseMonth, day: baseDay, hour, minute });
      } else {
        // iOS: true yearly calendar repeats
        await scheduleYearlyNotification({ title, body: `It's today! 💞 Did you plan something?`, month: baseMonth, day: baseDay, hour, minute });
        const d1 = new Date(new Date(2000, baseMonth - 1, baseDay).getTime() - DAY);
        await scheduleYearlyNotification({ title, body: `Tomorrow is your ${title}. A tiny plan goes a long way ✨`, month: d1.getMonth() + 1, day: d1.getDate(), hour, minute });
        const d7 = new Date(new Date(2000, baseMonth - 1, baseDay).getTime() - 7 * DAY);
        await scheduleYearlyNotification({ title, body: `One week until your ${title}! Want ideas?`, month: d7.getMonth() + 1, day: d7.getDate(), hour, minute });
      }

      if (forBoth && canCreateForBoth && partnerUid) {
        const dueAt = nextOccurrence(baseMonth, baseDay, hour, minute);
        await createPartnerReminderDoc({ forUid: partnerUid, ownerId: user.uid, pairId, title, dueAt });
      }

      setBanner('Reminders saved ✨');
      setTimeout(() => setBanner(null), 1800);

      // allow Android to register before reading back
      setTimeout(() => { loadScheduled(); }, 2000);
    } catch (e: any) {
      Alert.alert('Could not schedule', e?.message ?? 'Please try again.');
    } finally {
      setSaving(false);
    }
  }

  const fixedSummary = `We’ll remind you 7 days before, 1 day before, and on the day${
    timeOnly ? ` at ${formatLocalTime(timeOnly)}` : ''
  }.`;

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

          <View ref={toggleRef}>
            <SpotlightTarget id="rem-toggle">
              <View style={[s.toggleRow, { marginTop: t.spacing.md }]}>
                <ThemedText variant="body">Also create for partner</ThemedText>
                <Switch
                  value={forBoth}
                  onValueChange={setForBoth}
                  disabled={!canCreateForBoth}
                  trackColor={{ false: withAlpha(t.colors.text, 0.15), true: withAlpha(t.colors.primary, 0.4) }}
                  thumbColor={Platform.OS === 'android' ? (forBoth ? t.colors.primary : '#f4f3f4') : undefined}
                  ios_backgroundColor={withAlpha(t.colors.text, 0.15)}
                />
              </View>
            </SpotlightTarget>
          </View>

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
                    <ThemedText variant="title">{req.content?.title ?? 'Reminder'}</ThemedText>
                    <ThemedText variant="caption" color={t.colors.textDim} style={{ marginTop: 2 }}>
                      {triggerToText((req as any).trigger)}
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
        />
        <DateTimePickerModal
          isVisible={showTimePicker}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          date={timeOnly ?? new Date(2000, 0, 1, 9, 0)}
          onConfirm={(d: Date) => { setTimeOnly(d); setShowTimePicker(false); }}
          onCancel={() => setShowTimePicker(false)}
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