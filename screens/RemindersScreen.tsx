import * as Notifications from 'expo-notifications';
import React, { useEffect, useMemo, useState } from 'react';
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useColorScheme } from '../hooks/useColorScheme';
import { useNotificationsSetup } from '../hooks/useNotificationsSetup';

type Mode = 'daily' | 'weekly' | 'interval' | 'date';

type Scheduled = Notifications.ScheduledNotification;

const DEFAULT_CONTENT: Notifications.NotificationContentInput = {
  title: 'LovePoints',
  body: 'A little nudge from your LovePoints app 💖',
  sound: 'default', // iOS only string | Android ignored
  data: { source: 'reminder' },
};

export default function RemindersScreen() {
  useNotificationsSetup(); // asks permission & config channels once
  const scheme = useColorScheme();
  const [mode, setMode] = useState<Mode>('daily');

  // inputs
  const [hour, setHour] = useState<number | ''>(9);
  const [minute, setMinute] = useState<number | ''>(0);
  const [weekday, setWeekday] = useState<number | ''>(1); // 1..7 Mon..Sun
  const [seconds, setSeconds] = useState<number | ''>(3600);
  const [dateIso, setDateIso] = useState<string>(''); // yyyy-mm-ddThh:mm

  // content inputs
  const [title, setTitle] = useState<string>('');
  const [body, setBody] = useState<string>('');

  // list
  const [scheduled, setScheduled] = useState<Scheduled[]>([]);
  const [loading, setLoading] = useState(false);

  // toast
  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1700);
  };

  const theme = useMemo(
    () => ({
      bg: scheme === 'dark' ? '#0b0b0f' : '#fff',
      text: scheme === 'dark' ? '#fff' : '#111',
      sub: scheme === 'dark' ? '#bbb' : '#555',
      card: scheme === 'dark' ? '#12131a' : '#fafafa',
      border: scheme === 'dark' ? '#262738' : '#eee',
      primary: '#5B5BFF',
      danger: '#E65850',
      ghost: '#eee',
    }),
    [scheme]
  );

  const content: Notifications.NotificationContentInput = {
    ...DEFAULT_CONTENT,
    title: title?.trim() || DEFAULT_CONTENT.title!,
    body: body?.trim() || DEFAULT_CONTENT.body!,
  };

  async function reload() {
    setLoading(true);
    try {
      const list = await Notifications.getAllScheduledNotificationsAsync();
      setScheduled(list);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
  }, []);

  // ---------- Scheduling helpers (typed triggers) ----------
  async function scheduleDaily(h: number, m: number) {
    const trigger: Notifications.DailyTriggerInput = {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: h,
      minute: m,
      repeats: true,
    };
    await Notifications.scheduleNotificationAsync({ content, trigger });
  }

  async function scheduleWeekly(dow: number, h: number, m: number) {
    const trigger: Notifications.CalendarTriggerInput = {
      type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
      weekday: dow, // 1..7
      hour: h,
      minute: m,
      repeats: true,
    };
    await Notifications.scheduleNotificationAsync({ content, trigger });
  }

  async function scheduleInterval(sec: number) {
    const trigger: Notifications.TimeIntervalTriggerInput = {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: Math.max(60, sec),
      repeats: true,
    };
    await Notifications.scheduleNotificationAsync({ content, trigger });
  }

  async function scheduleDate(iso: string) {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) throw new Error('Invalid date/time');
    // Date trigger: one-off (no repeats)
    await Notifications.scheduleNotificationAsync({
      content,
      trigger: date,
    });
  }

  // ---------- Inline validation ----------
  const { valid, hint } = useMemo(() => {
    if (mode === 'daily') {
      if (hour === '' || minute === '') return { valid: false, hint: 'Pick hour and minute' };
      if (hour! < 0 || hour! > 23 || minute! < 0 || minute! > 59) return { valid: false, hint: 'Time out of range' };
      return { valid: true, hint: '' };
    }
    if (mode === 'weekly') {
      if (weekday === '' || hour === '' || minute === '') return { valid: false, hint: 'Select weekday & time' };
      if (weekday! < 1 || weekday! > 7) return { valid: false, hint: 'Weekday 1..7' };
      if (hour! < 0 || hour! > 23 || minute! < 0 || minute! > 59) return { valid: false, hint: 'Time out of range' };
      return { valid: true, hint: '' };
    }
    if (mode === 'interval') {
      if (seconds === '' || seconds! < 60) return { valid: false, hint: 'Minimum 60 seconds' };
      return { valid: true, hint: '' };
    }
    // date
    if (!dateIso) return { valid: false, hint: 'Pick a date & time' };
    if (Number.isNaN(new Date(dateIso).getTime())) return { valid: false, hint: 'Invalid date/time' };
    return { valid: true, hint: '' };
  }, [mode, hour, minute, weekday, seconds, dateIso]);

  async function onAdd() {
    try {
      if (!valid) return;
      if (mode === 'daily') await scheduleDaily(Number(hour), Number(minute));
      else if (mode === 'weekly') await scheduleWeekly(Number(weekday), Number(hour), Number(minute));
      else if (mode === 'interval') await scheduleInterval(Number(seconds));
      else await scheduleDate(dateIso);

      showToast('Reminder scheduled 💘');
      await reload();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? String(e));
    }
  }

  async function cancel(id: string) {
    await Notifications.cancelScheduledNotificationAsync(id);
    showToast('Reminder canceled');
    await reload();
  }

  async function cancelAll() {
    Alert.alert('Cancel all reminders?', 'This removes every scheduled reminder.', [
      { text: 'No' },
      {
        text: 'Yes, remove all',
        style: 'destructive',
        onPress: async () => {
          await Notifications.cancelAllScheduledNotificationsAsync();
          await reload();
        },
      },
    ]);
  }

  // ---------- Quick chips (auto-suggest labels) ----------
  const quickChips: Array<{ label: string; action: () => void }> = [
    { label: 'Daily 09:00', action: () => { setMode('daily'); setHour(9); setMinute(0); } },
    { label: 'Daily 20:00', action: () => { setMode('daily'); setHour(20); setMinute(0); } },
    { label: 'Fri 18:00', action: () => { setMode('weekly'); setWeekday(5); setHour(18); setMinute(0); } },
    { label: 'Sun 10:00', action: () => { setMode('weekly'); setWeekday(7); setHour(10); setMinute(0); } },
    { label: 'Every 2h', action: () => { setMode('interval'); setSeconds(7200); } },
  ];

  return (
    <KeyboardAvoidingView
      behavior={Platform.select({ ios: 'padding', android: undefined })}
      style={[styles.container, { backgroundColor: theme.bg }]}
    >
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text style={[styles.h1, { color: theme.text }]}>Reminders</Text>
        <Text style={[styles.sub, { color: theme.sub }]}>
          Gentle nudges to keep the romance active ✨
        </Text>

        {/* Mode selector */}
        <View style={styles.segment}>
          {(['daily', 'weekly', 'interval', 'date'] as Mode[]).map((m) => (
            <TouchableOpacity
              key={m}
              onPress={() => setMode(m)}
              style={[
                styles.segmentBtn,
                { borderColor: theme.border, backgroundColor: mode === m ? theme.primary : 'transparent' },
              ]}
            >
              <Text style={[styles.segmentText, { color: mode === m ? '#fff' : theme.text }]}>
                {m[0].toUpperCase() + m.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Quick chips */}
        <View style={styles.chips}>
          {quickChips.map((c) => (
            <TouchableOpacity
              key={c.label}
              onPress={c.action}
              style={[styles.chip, { backgroundColor: theme.card, borderColor: theme.border }]}
            >
              <Text style={{ color: theme.text }}>{c.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Content inputs */}
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.label, { color: theme.sub }]}>Title</Text>
          <TextInput
            placeholder="LovePoints"
            placeholderTextColor={theme.sub}
            style={[styles.input, { color: theme.text, borderColor: theme.border }]}
            value={title}
            onChangeText={setTitle}
          />
          <Text style={[styles.label, { color: theme.sub }]}>Message</Text>
          <TextInput
            placeholder="A little nudge from your LovePoints app 💖"
            placeholderTextColor={theme.sub}
            style={[styles.input, { color: theme.text, borderColor: theme.border }]}
            value={body}
            onChangeText={setBody}
          />
        </View>

        {/* Mode-specific inputs */}
        {mode === 'daily' && (
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.label, { color: theme.sub }]}>Time (24h)</Text>
            <View style={styles.row}>
              <TextInput
                keyboardType="number-pad"
                style={[styles.small, { color: theme.text, borderColor: theme.border }]}
                value={hour === '' ? '' : String(hour)}
                onChangeText={(t) => setHour(t === '' ? '' : Number(t))}
                placeholder="hh"
                placeholderTextColor={theme.sub}
                maxLength={2}
              />
              <Text style={[styles.colon, { color: theme.text }]}>:</Text>
              <TextInput
                keyboardType="number-pad"
                style={[styles.small, { color: theme.text, borderColor: theme.border }]}
                value={minute === '' ? '' : String(minute)}
                onChangeText={(t) => setMinute(t === '' ? '' : Number(t))}
                placeholder="mm"
                placeholderTextColor={theme.sub}
                maxLength={2}
              />
            </View>
          </View>
        )}

        {mode === 'weekly' && (
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.label, { color: theme.sub }]}>Weekday (1..7)</Text>
            <TextInput
              keyboardType="number-pad"
              style={[styles.input, { color: theme.text, borderColor: theme.border }]}
              value={weekday === '' ? '' : String(weekday)}
              onChangeText={(t) => setWeekday(t === '' ? '' : Number(t))}
              placeholder="1 = Mon ... 7 = Sun"
              placeholderTextColor={theme.sub}
              maxLength={1}
            />
            <Text style={[styles.label, { color: theme.sub, marginTop: 12 }]}>Time (24h)</Text>
            <View style={styles.row}>
              <TextInput
                keyboardType="number-pad"
                style={[styles.small, { color: theme.text, borderColor: theme.border }]}
                value={hour === '' ? '' : String(hour)}
                onChangeText={(t) => setHour(t === '' ? '' : Number(t))}
                placeholder="hh"
                placeholderTextColor={theme.sub}
                maxLength={2}
              />
              <Text style={[styles.colon, { color: theme.text }]}>:</Text>
              <TextInput
                keyboardType="number-pad"
                style={[styles.small, { color: theme.text, borderColor: theme.border }]}
                value={minute === '' ? '' : String(minute)}
                onChangeText={(t) => setMinute(t === '' ? '' : Number(t))}
                placeholder="mm"
                placeholderTextColor={theme.sub}
                maxLength={2}
              />
            </View>
          </View>
        )}

        {mode === 'interval' && (
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.label, { color: theme.sub }]}>Every (seconds)</Text>
            <TextInput
              keyboardType="number-pad"
              style={[styles.input, { color: theme.text, borderColor: theme.border }]}
              value={seconds === '' ? '' : String(seconds)}
              onChangeText={(t) => setSeconds(t === '' ? '' : Number(t))}
              placeholder="≥ 60"
              placeholderTextColor={theme.sub}
            />
          </View>
        )}

        {mode === 'date' && (
          <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.label, { color: theme.sub }]}>Date & time</Text>
            <TextInput
              style={[styles.input, { color: theme.text, borderColor: theme.border }]}
              value={dateIso}
              onChangeText={setDateIso}
              placeholder="YYYY-MM-DDThh:mm"
              placeholderTextColor={theme.sub}
            />
          </View>
        )}

        {/* Inline validation */}
        {!valid && !!hint && <Text style={[styles.hint, { color: theme.sub }]}>{hint}</Text>}

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity
            onPress={onAdd}
            disabled={!valid}
            style={[
              styles.actionBtn,
              { backgroundColor: valid ? theme.primary : theme.ghost, opacity: valid ? 1 : 0.6 },
            ]}
          >
            <Text style={styles.actionText}>Add reminder</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={cancelAll} style={[styles.actionBtn, { backgroundColor: theme.danger }]}>
            <Text style={styles.actionText}>Cancel all</Text>
          </TouchableOpacity>
        </View>

        {/* List */}
        <Text style={[styles.h2, { color: theme.text, marginTop: 16 }]}>Scheduled</Text>
        {loading ? (
          <Text style={{ color: theme.sub, marginTop: 8 }}>Loading…</Text>
        ) : scheduled.length === 0 ? (
          <View style={[styles.empty, { borderColor: theme.border, backgroundColor: theme.card }]}>
            <Text style={{ color: theme.sub }}>No reminders yet — add your first one! 💡</Text>
          </View>
        ) : (
          scheduled.map((s) => {
            const trig = s.trigger as any;
            let when = '';
            if (trig?.type === 'daily') when = `Daily ${pad(trig.hour)}:${pad(trig.minute)}`;
            else if (trig?.type === 'calendar')
              when = `Weekly ${weekdayName(trig.weekday)} ${pad(trig.hour)}:${pad(trig.minute)}`;
            else if (trig?.type === 'timeInterval') when = `Every ~${trig.seconds}s`;
            else if (trig?.date) when = new Date(trig.date).toLocaleString();
            return (
              <View key={s.identifier} style={[styles.cardRow, { borderColor: theme.border, backgroundColor: theme.card }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardTitle, { color: theme.text }]} numberOfLines={1}>
                    {s.content?.title ?? 'LovePoints'}
                  </Text>
                  <Text style={{ color: theme.sub }} numberOfLines={2}>
                    {s.content?.body ?? 'Reminder'}
                  </Text>
                  {!!when && <Text style={{ color: theme.sub, marginTop: 4 }}>{when}</Text>}
                </View>
                <TouchableOpacity onPress={() => cancel(s.identifier)} style={[styles.smallBtn, { backgroundColor: theme.danger }]}>
                  <Text style={styles.smallBtnText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Toast */}
      {toast && (
        <View style={styles.toastWrap} pointerEvents="none">
          <View style={styles.toast}>
            <Text style={styles.toastText}>{toast}</Text>
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

function pad(n?: number) {
  if (typeof n !== 'number') return '--';
  return n < 10 ? `0${n}` : String(n);
}
function weekdayName(w?: number) {
  const arr = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  if (!w || w < 1 || w > 7) return '?';
  return arr[w - 1];
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  h1: { fontSize: 28, fontWeight: '800' },
  h2: { fontSize: 18, fontWeight: '700' },
  sub: { marginTop: 6 },
  segment: { flexDirection: 'row', gap: 8, marginTop: 12 },
  segmentBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  segmentText: { fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  card: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  label: { fontWeight: '700', marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  small: {
    flex: 0,
    width: 80,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  colon: { fontSize: 18, fontWeight: '700' },
  hint: { marginTop: 8 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  actionBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 12,
  },
  actionText: { color: '#fff', fontWeight: '800' },
  cardRow: {
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardTitle: { fontWeight: '800', fontSize: 16 },
  smallBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  smallBtnText: { color: '#fff', fontWeight: '800' },
  empty: {
    marginTop: 10,
    padding: 16,
    borderWidth: 1,
    borderRadius: 14,
    alignItems: 'center',
  },
  toastWrap: {
    position: 'absolute',
    bottom: 24,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  toast: {
    backgroundColor: '#111',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
  },
  toastText: { color: '#fff', fontWeight: '700' },
});
