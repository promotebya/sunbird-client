import * as Notifications from 'expo-notifications';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
    Alert,
    Animated,
    Easing,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import useColorScheme from '../hooks/useColorScheme';

type QuickChip =
  | { id: 'daily'; label: string }
  | { id: 'this-week'; label: string }
  | { id: 'interval'; label: string };

const QUICK_CHIPS: QuickChip[] = [
  { id: 'daily', label: 'Daily 09:00' },
  { id: 'this-week', label: 'Weekdays 18:00' },
  { id: 'interval', label: 'Every 30 min' },
];

export default function RemindersScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // form state
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [dateIso, setDateIso] = useState(''); // ISO like 2025-09-01T19:30
  const [hour, setHour] = useState('9');
  const [minute, setMinute] = useState('0');
  const [intervalSecs, setIntervalSecs] = useState('1800'); // 30 min
  const [selectedChip, setSelectedChip] = useState<QuickChip['id'] | null>(null);

  // inline errors
  const [errTitle, setErrTitle] = useState<string | null>(null);
  const [errTiming, setErrTiming] = useState<string | null>(null);

  // tiny toast
  const toastY = useRef(new Animated.Value(-50)).current;
  const [toastMsg, setToastMsg] = useState('');

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    Animated.sequence([
      Animated.timing(toastY, { toValue: 0, duration: 200, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.delay(1200),
      Animated.timing(toastY, { toValue: -50, duration: 200, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, [toastY]);

  // tiny confetti (emoji burst)
  const confettiOpacity = useRef(new Animated.Value(0)).current;
  const popConfetti = useCallback(() => {
    confettiOpacity.setValue(0);
    Animated.sequence([
      Animated.timing(confettiOpacity, { toValue: 1, duration: 120, useNativeDriver: true }),
      Animated.delay(600),
      Animated.timing(confettiOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start();
  }, [confettiOpacity]);

  const content = useMemo<Notifications.NotificationContentInput>(() => ({
    title: title.trim() || 'Reminder',
    body: body.trim() || null,
    sound: 'default',
    badge: null,
    data: { source: 'reminders' },
  }), [title, body]);

  const resetErrors = () => {
    setErrTitle(null);
    setErrTiming(null);
  };

  const validateTitle = () => {
    if (!title.trim()) {
      setErrTitle('Please add a short title.');
      return false;
    }
    return true;
  };

  const scheduleDate = async () => {
    resetErrors();
    if (!validateTitle()) return;

    const d = new Date(dateIso);
    if (Number.isNaN(d.getTime())) {
      setErrTiming('Please enter a valid date/time (e.g., 2025-09-01T19:30).');
      return;
    }

    const trigger: Notifications.DateTriggerInput = {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: d, // NOTE: no repeats on Date triggers
    };

    await Notifications.scheduleNotificationAsync({ content, trigger });
  };

  const scheduleDaily = async () => {
    resetErrors();
    if (!validateTitle()) return;

    const h = Number(hour);
    const m = Number(minute);
    if (!Number.isFinite(h) || !Number.isFinite(m) || h < 0 || h > 23 || m < 0 || m > 59) {
      setErrTiming('Please enter a valid hour/minute (0–23 / 0–59).');
      return;
    }

    const trigger: Notifications.DailyTriggerInput = {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: h,
      minute: m,
    };

    await Notifications.scheduleNotificationAsync({ content, trigger });
  };

  const scheduleWeekdays = async () => {
    resetErrors();
    if (!validateTitle()) return;

    const h = 18;
    const m = 0;
    // Weekdays 1..7 (Mon=2 in some locales; Expo uses 1..7 Sun..Sat)
    const weekdays = [2, 3, 4, 5, 6]; // Mon-Fri

    await Promise.all(
      weekdays.map((weekday) => {
        const trigger: Notifications.CalendarTriggerInput = {
          type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
          weekday,
          hour: h,
          minute: m,
          repeats: true,
        };
        return Notifications.scheduleNotificationAsync({ content, trigger });
      })
    );
  };

  const scheduleInterval = async () => {
    resetErrors();
    if (!validateTitle()) return;

    const secs = Number(intervalSecs);
    if (!Number.isFinite(secs) || secs <= 0) {
      setErrTiming('Please enter a positive number of seconds.');
      return;
    }

    const trigger: Notifications.TimeIntervalTriggerInput = {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: secs,
      repeats: true,
    };

    await Notifications.scheduleNotificationAsync({ content, trigger });
  };

  const onSubmit = async () => {
    try {
      if (selectedChip === 'daily') {
        await scheduleDaily();
      } else if (selectedChip === 'this-week') {
        await scheduleWeekdays();
      } else if (selectedChip === 'interval') {
        await scheduleInterval();
      } else {
        await scheduleDate();
      }
      showToast('Reminder scheduled ✅');
      popConfetti();
      setTitle('');
      setBody('');
      setDateIso('');
    } catch (e: any) {
      console.error(e);
      Alert.alert('Oops', e?.message ?? 'Could not schedule reminder.');
    }
  };

  const renderChip = ({ item }: { item: QuickChip }) => {
    const active = selectedChip === item.id;
    return (
      <Pressable
        onPress={() => setSelectedChip(item.id)}
        style={[styles.chip, active && styles.chipActive]}
      >
        <Text style={[styles.chipText, active && styles.chipTextActive]}>{item.label}</Text>
      </Pressable>
    );
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, isDark && { backgroundColor: '#0b0b0d' }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Toast */}
      <Animated.View style={[styles.toast, { transform: [{ translateY: toastY }] }]}>
        <Text style={styles.toastText}>{toastMsg}</Text>
      </Animated.View>

      {/* Confetti */}
      <Animated.View style={[styles.confettiWrap, { opacity: confettiOpacity }]}>
        <Text style={styles.confetti}>🎉🎉🎉</Text>
      </Animated.View>

      <View style={styles.header}>
        <Text style={[styles.title, isDark && { color: '#fff' }]}>Reminders</Text>
        <Text style={styles.subtitle}>Lightweight nudges to keep love top of mind</Text>
      </View>

      <View style={styles.card}>
        <TextInput
          placeholder="Title (e.g., Text your partner 💌)"
          placeholderTextColor="#999"
          value={title}
          onChangeText={setTitle}
          style={styles.input}
        />
        {errTitle ? <Text style={styles.error}>{errTitle}</Text> : null}

        <TextInput
          placeholder="Optional note"
          placeholderTextColor="#999"
          value={body}
          onChangeText={setBody}
          style={[styles.input, { height: 44 }]}
        />

        <FlatList
          data={QUICK_CHIPS}
          keyExtractor={(c) => c.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingVertical: 8 }}
          renderItem={renderChip}
        />

        {/* Date-only inputs (used when no chip is selected) */}
        {selectedChip === null && (
          <>
            <TextInput
              placeholder="Exact date/time (ISO) e.g. 2025-09-01T19:30"
              placeholderTextColor="#999"
              value={dateIso}
              onChangeText={setDateIso}
              style={styles.input}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </>
        )}

        {/* Daily */}
        {selectedChip === 'daily' && (
          <View style={styles.row}>
            <TextInput
              placeholder="Hour (0–23)"
              placeholderTextColor="#999"
              keyboardType="numeric"
              value={hour}
              onChangeText={setHour}
              style={[styles.input, styles.inputHalf]}
            />
            <TextInput
              placeholder="Minute (0–59)"
              placeholderTextColor="#999"
              keyboardType="numeric"
              value={minute}
              onChangeText={setMinute}
              style={[styles.input, styles.inputHalf]}
            />
          </View>
        )}

        {/* Interval */}
        {selectedChip === 'interval' && (
          <TextInput
            placeholder="Every N seconds (e.g., 1800)"
            placeholderTextColor="#999"
            keyboardType="numeric"
            value={intervalSecs}
            onChangeText={setIntervalSecs}
            style={styles.input}
          />
        )}

        {errTiming ? <Text style={styles.error}>{errTiming}</Text> : null}

        <Pressable onPress={onSubmit} style={styles.actionBtn}>
          <Text style={styles.actionText}>Schedule</Text>
        </Pressable>

        <Text style={styles.hint}>
          Pro tip: use quick chips for daily / weekday / interval reminders. Exact date uses ISO:
          {' '}
          <Text style={{ fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }) }}>
            2025-09-01T19:30
          </Text>
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fbfbff' },
  header: { marginTop: 8, marginBottom: 12 },
  title: { fontSize: 28, fontWeight: '800', color: '#121212' },
  subtitle: { color: '#6b7280', marginTop: 4 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 2,
  },
  input: {
    backgroundColor: '#f5f6f8',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    color: '#111',
    marginBottom: 10,
  },
  row: { flexDirection: 'row', gap: 10 },
  inputHalf: { flex: 1 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#f3f4f6',
    borderRadius: 999,
    marginRight: 8,
  },
  chipActive: { backgroundColor: '#EAD7F5' },
  chipText: { color: '#4b5563', fontWeight: '600' },
  chipTextActive: { color: '#5b21b6' },
  actionBtn: {
    backgroundColor: '#5B58FF',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 6,
  },
  actionText: { color: '#fff', fontWeight: '800' },
  error: { color: '#E11D48', marginBottom: 8, fontWeight: '600' },
  hint: { marginTop: 10, color: '#6b7280' },

  toast: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: 8,
    zIndex: 20,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#111827',
    alignItems: 'center',
  },
  toastText: { color: '#fff', fontWeight: '700' },

  confettiWrap: { position: 'absolute', top: 56, right: 16, zIndex: 19 },
  confetti: { fontSize: 24 },
});
