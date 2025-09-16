// screens/RemindersScreen.tsx
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Switch, TextInput, View } from 'react-native';
import DateTimePickerModal from 'react-native-modal-datetime-picker';

import Card from '../components/Card';
import Screen from '../components/Screen';
import ThemedText from '../components/ThemedText';
import { tokens } from '../components/tokens';

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

const RemindersScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { user } = useAuthListener();

  const [pairId, setPairId] = useState<string | null>(null);
  const [partnerUid, setPartnerUid] = useState<string | null>(null);

  const [title, setTitle] = useState('Anniversary');
  const [dateOnly, setDateOnly] = useState<Date | null>(null);
  const [timeOnly, setTimeOnly] = useState<Date | null>(null);

  const [remind7, setRemind7] = useState(true);
  const [remind1, setRemind1] = useState(true);
  const [remind0, setRemind0] = useState(true);
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

  const dateLabel = dateOnly
    ? dateOnly.toLocaleDateString(undefined, { day: 'numeric', month: 'long' })
    : 'Select date…';
  const timeLabel = timeOnly ? formatLocalTime(timeOnly) : 'Select time…';

  function ensureHasDefaults() {
    if (!dateOnly) setDateOnly(new Date());
    if (!timeOnly) setTimeOnly(new Date(2000, 0, 1, 9, 0));
  }

  function nextOccurrence(month1to12: number, day: number, hour: number, minute: number) {
    const now = new Date();
    const year = now.getFullYear();
    let candidate = new Date(year, month1to12 - 1, day, hour, minute, 0, 0);
    if (candidate.getTime() <= now.getTime())
      candidate = new Date(year + 1, month1to12 - 1, day, hour, minute, 0, 0);
    return candidate;
  }

  const loadScheduled = useCallback(async () => {
    setLoadingScheduled(true);
    try {
      const items = await Notifications.getAllScheduledNotificationsAsync();
      items.sort((a, b) => {
        const ta = a.content.title ?? '';
        const tb = b.content.title ?? '';
        if (ta !== tb) return ta.localeCompare(tb);
        return triggerToText(a.trigger).localeCompare(triggerToText(b.trigger));
      });
      setScheduled(items);
    } finally {
      setLoadingScheduled(false);
    }
  }, []);

  useEffect(() => { loadScheduled(); }, [loadScheduled]);
  useFocusEffect(useCallback(() => { loadScheduled(); }, [loadScheduled]));

  // Show ONLY the "on the day" anchor; hide "One week…" and "Tomorrow…"
  const visibleScheduled = useMemo(() => {
    return scheduled.filter((req) => {
      const body = (req.content.body ?? '') as string;
      return !/one week/i.test(body) && !/tomorrow/i.test(body);
    });
  }, [scheduled]);

  function triggerToText(trigger: any): string {
    if (!trigger) return 'Scheduled';

    const CAL  = Notifications.SchedulableTriggerInputTypes.CALENDAR;
    const DATE = Notifications.SchedulableTriggerInputTypes.DATE;
    const INT  = Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL;
    const t = trigger.type;

    if (t === CAL || t === 'calendar') {
      const comps = trigger.dateComponents && typeof trigger.dateComponents === 'object'
        ? trigger.dateComponents
        : trigger;
      const month  = comps.month  ?? 1;
      const day    = comps.day    ?? 1;
      const hour   = comps.hour   ?? 0;
      const minute = comps.minute ?? 0;
      const when = new Date(2000, month - 1, day, hour, minute, 0, 0);
      const md = when.toLocaleDateString([], { month: 'long', day: 'numeric' });
      const hm = when.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return `${md} • ${hm} • yearly`;
    }

    if (t === DATE || t === 'date') {
      const d = trigger.date ? new Date(trigger.date) : null;
      return d
        ? `${d.toLocaleDateString()} • ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
        : 'Scheduled date';
    }

    if (t === INT || t === 'timeInterval') {
      const mins = trigger.seconds ? Math.round(trigger.seconds / 60) : 0;
      return mins ? `in ${mins} min${mins === 1 ? '' : 's'}` : 'Time interval';
    }

    return 'Scheduled';
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
      Alert.alert(
        'Enable notifications',
        'Notifications are disabled for this app. Please enable them in Settings to schedule reminders.'
      );
      return;
    }

    setSaving(true);
    try {
      const baseMonth = dateOnly.getMonth() + 1;
      const baseDay = dateOnly.getDate();
      const hour = timeOnly.getHours();
      const minute = timeOnly.getMinutes();

      if (remind0) {
        await scheduleYearlyNotification({
          title,
          body: `It's today! 💞 Did you plan something?`,
          month: baseMonth,
          day: baseDay,
          hour,
          minute,
        });
      }
      if (remind1) {
        const d = new Date(new Date(2000, baseMonth - 1, baseDay).getTime() - 24 * 60 * 60 * 1000);
        await scheduleYearlyNotification({
          title,
          body: `Tomorrow is your ${title}. A tiny plan goes a long way ✨`,
          month: d.getMonth() + 1,
          day: d.getDate(),
          hour,
          minute,
        });
      }
      if (remind7) {
        const d = new Date(new Date(2000, baseMonth - 1, baseDay).getTime() - 7 * 24 * 60 * 60 * 1000);
        await scheduleYearlyNotification({
          title,
          body: `One week until your ${title}! Want ideas?`,
          month: d.getMonth() + 1,
          day: d.getDate(),
          hour,
          minute,
        });
      }

      if (forBoth && canCreateForBoth && partnerUid) {
        const dueAt = nextOccurrence(baseMonth, baseDay, hour, minute);
        await createPartnerReminderDoc({ forUid: partnerUid, ownerId: user.uid, pairId, title, dueAt });
      }

      setBanner('Reminders saved ✨');
      setTimeout(() => setBanner(null), 2000);
      await loadScheduled();
    } catch (e: any) {
      Alert.alert('Could not schedule', e?.message ?? 'Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen keyboard>
      <View style={styles.header}>
        <ThemedText variant="display">Anniversary</ThemedText>

        <Pressable
          onPress={() => navigation.navigate('Reminders', { screen: 'RemindersInbox' })}
          style={styles.inboxBtn}
        >
          <ThemedText variant="label" color="#fff">Inbox</ThemedText>
          {badge ? (
            <View style={styles.inboxBadge}>
              <ThemedText variant="caption" color="#fff">{badge}</ThemedText>
            </View>
          ) : null}
        </Pressable>

        <ThemedText variant="subtitle" color={tokens.colors.textDim} style={{ marginTop: tokens.spacing.xs }}>
          Yearly reminders: 7 days before, 1 day before, and on the day.
        </ThemedText>
      </View>

      <Card>
        <ThemedText variant="h2" style={{ marginBottom: tokens.spacing.s }}>Title</ThemedText>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Anniversary"
          placeholderTextColor={tokens.colors.textDim}
          style={styles.input}
          onFocus={ensureHasDefaults}
        />
        <View style={styles.rowWrap}>
          {['Anniversary', 'First Date', 'Engagement Day', 'Wedding Day'].map((t) => (
            <Pressable key={t} onPress={() => setTitle(t)} style={styles.pill}>
              <ThemedText variant="label">{t}</ThemedText>
            </Pressable>
          ))}
        </View>
      </Card>

      <Card style={{ marginTop: tokens.spacing.md }}>
        <ThemedText variant="h2">Date</ThemedText>
        <Pressable onPress={() => { ensureHasDefaults(); setShowDatePicker(true); }} style={styles.input}>
          <ThemedText variant="body" color={dateOnly ? tokens.colors.text : tokens.colors.textDim}>
            {dateLabel}
          </ThemedText>
        </Pressable>

        <ThemedText variant="h2" style={{ marginTop: tokens.spacing.md }}>Time</ThemedText>
        <Pressable onPress={() => { ensureHasDefaults(); setShowTimePicker(true); }} style={styles.input}>
          <ThemedText variant="body" color={timeOnly ? tokens.colors.text : tokens.colors.textDim}>
            {timeLabel}
          </ThemedText>
        </Pressable>

        <View style={styles.toggleRow}>
          <ThemedText variant="body">Remind 7 days before</ThemedText>
          <Switch value={remind7} onValueChange={setRemind7} />
        </View>
        <View style={styles.toggleRow}>
          <ThemedText variant="body">Remind 1 day before</ThemedText>
          <Switch value={remind1} onValueChange={setRemind1} />
        </View>
        <View style={styles.toggleRow}>
          <ThemedText variant="body">Remind on the day</ThemedText>
          <Switch value={remind0} onValueChange={setRemind0} />
        </View>

        <View style={styles.toggleRow}>
          <ThemedText variant="body">Also create for partner</ThemedText>
          <Switch
            value={forBoth}
            onValueChange={setForBoth}
            disabled={!canCreateForBoth}
            trackColor={{ true: '#FF9FBE', false: '#D1D5DB' }}
            thumbColor={forBoth ? tokens.colors.primary : '#f4f3f4'}
          />
        </View>

        <Pressable onPress={onSave} disabled={saving} style={[styles.saveBtn, saving && { opacity: 0.6 }]}>
          <ThemedText variant="button" color="#fff">{saving ? 'Saving…' : 'Save reminders'}</ThemedText>
        </Pressable>
      </Card>

      {/* Saved reminders — ONLY the anchor “on the day” */}
      <Card style={{ marginTop: tokens.spacing.md }}>
        <View style={styles.savedHeader}>
          <ThemedText variant="h2">Saved reminders</ThemedText>
          <Pressable onPress={loadScheduled} style={styles.refreshBtn}>
            <ThemedText variant="label">{loadingScheduled ? 'Loading…' : 'Refresh'}</ThemedText>
          </Pressable>
        </View>

        {visibleScheduled.length === 0 ? (
          <ThemedText variant="caption" color={tokens.colors.textDim}>No local reminders yet.</ThemedText>
        ) : (
          <View style={{ rowGap: 10 }}>
            {visibleScheduled.map((req) => (
              <View key={req.identifier} style={styles.savedRow}>
                <View style={{ flex: 1 }}>
                  <ThemedText variant="title">{req.content.title ?? 'Reminder'}</ThemedText>
                  <ThemedText variant="caption" color={tokens.colors.textDim} style={{ marginTop: 2 }}>
                    {triggerToText(req.trigger as any)}
                  </ThemedText>
                </View>
                <Pressable onPress={() => onCancel(req.identifier)} style={styles.cancelBtn}>
                  <ThemedText variant="label" color="#fff">Cancel</ThemedText>
                </Pressable>
              </View>
            ))}
          </View>
        )}
      </Card>

      {/* Pickers */}
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
        <View style={styles.toast}>
          <ThemedText variant="button" color="#fff" center>{banner}</ThemedText>
        </View>
      ) : null}
    </Screen>
  );
};

const styles = StyleSheet.create({
  header: { paddingBottom: tokens.spacing.s },
  inboxBtn: {
    alignSelf: 'flex-start',
    marginTop: tokens.spacing.s,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.xs as number,
    backgroundColor: tokens.colors.primary,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: 6,
    borderRadius: 999,
  },
  inboxBadge: {
    marginLeft: tokens.spacing.xs,
    minWidth: 18, height: 18, paddingHorizontal: 6,
    borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  input: {
    minHeight: 44,
    paddingVertical: tokens.spacing.s,
    paddingHorizontal: tokens.spacing.md,
    backgroundColor: tokens.colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    color: tokens.colors.text,
    marginTop: tokens.spacing.s,
    justifyContent: 'center',
  },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: tokens.spacing.s },
  pill: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, backgroundColor: '#ECEFF3' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: tokens.spacing.md },
  saveBtn: { marginTop: tokens.spacing.lg, backgroundColor: tokens.colors.primary, paddingVertical: 12, borderRadius: tokens.radius.lg, alignItems: 'center' },
  savedHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: tokens.spacing.s },
  refreshBtn: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 999, backgroundColor: '#ECEFF3' },
  savedRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cancelBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: '#EF4444' },
  toast: { position: 'absolute', left: tokens.spacing.md, right: tokens.spacing.md, bottom: tokens.spacing.xl, backgroundColor: '#111827', padding: tokens.spacing.md, borderRadius: tokens.radius.lg },
});

export default RemindersScreen;
