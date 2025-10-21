// screens/RemindersInboxScreen.tsx
import { addDoc, collection } from 'firebase/firestore';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Pressable,
  SectionList,
  StyleSheet,
  View,
} from 'react-native';
import { RectButton, Swipeable } from 'react-native-gesture-handler';

import Card from '../components/Card';
import Screen from '../components/Screen';
import ThemedText from '../components/ThemedText';
import { useTokens, type ThemeTokens } from '../components/ThemeProvider';
import ToastUndo from '../components/ToastUndo';

import { db } from '../firebaseConfig';
import useAuthListener from '../hooks/useAuthListener';
import {
  ReminderDoc,
  removeReminder,
  subscribeRemindersForUid,
  updateReminderStatus,
} from '../utils/reminders';

function timeFromISO(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const day = d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  const hm = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return `${day} • ${hm}`;
}

const HAIRLINE = '#F0E6EF';

const ActionButton = ({
  color,
  label,
  onPress,
}: {
  color: string;
  label: string;
  onPress: () => void;
}) => (
  <RectButton onPress={onPress} style={[stylesStatic.actionBtn, { backgroundColor: color }]}>
    <ThemedText variant="button" color="#fff" center>
      {label}
    </ThemedText>
  </RectButton>
);

export default function RemindersInboxScreen() {
  const t = useTokens();
  const s = useMemo(() => styles(t), [t]);
  const { user } = useAuthListener();

  const [pending, setPending] = useState<ReminderDoc[]>([]);
  const [scheduled, setScheduled] = useState<ReminderDoc[]>([]);

  // simple filter tabs
  const [filter, setFilter] = useState<'all' | 'pending' | 'scheduled'>('all');

  const [toast, setToast] = useState<{
    visible: boolean;
    msg: string;
    undo?: () => Promise<void> | void;
  }>({ visible: false, msg: '' });

  // 🔁 Keep inbox lists in sync. Filter OUT dismissed items so they vanish after "Dismiss".
  useEffect(() => {
    if (!user) return;
    const unsub = subscribeRemindersForUid(user.uid, (p, sList) => {
      const onlyPending = (p ?? []).filter((r: any) => (r?.status ?? 'pending') === 'pending');
      const onlyScheduled = (sList ?? []).filter((r: any) => (r?.status ?? 'scheduled') === 'scheduled');
      setPending(onlyPending);
      setScheduled(onlyScheduled); // NOTE: dismissed items are intentionally excluded
    });
    return () => unsub && unsub();
  }, [user]);

  // Optimistic helpers
  const removeFromPending = (id: string) =>
    setPending(prev => prev.filter(r => r.id !== id));
  const removeFromScheduled = (id: string) =>
    setScheduled(prev => prev.filter(r => r.id !== id));
  const movePendingToScheduled = (id: string) =>
    setPending(prev => prev.filter(r => r.id !== id));

  async function onSchedule(item: ReminderDoc) {
    // optimistic: move out of pending (server sub will populate scheduled)
    movePendingToScheduled(item.id);
    try {
      await updateReminderStatus(item.id, 'scheduled');
      setToast({ visible: true, msg: 'Scheduled', undo: async () => updateReminderStatus(item.id, 'pending') });
    } catch (e: any) {
      // revert
      setPending(prev => [item, ...prev]);
      Alert.alert('Could not schedule', e?.message ?? 'Please try again.');
    }
  }

  async function onDelete(item: ReminderDoc) {
    const backup = item;
    // optimistic remove from pending list
    removeFromPending(item.id);
    try {
      await removeReminder(item.id);
      setToast({
        visible: true,
        msg: 'Reminder deleted',
        undo: async () => {
          const { id, ...payload } = backup as any;
          await addDoc(collection(db, 'reminders'), { ...payload, status: 'pending' });
        },
      });
    } catch (e: any) {
      // revert
      setPending(prev => [backup, ...prev]);
      Alert.alert('Could not delete', e?.message ?? 'Please try again.');
    }
  }

  async function onDismiss(item: ReminderDoc) {
    // optimistic remove from scheduled list; subscription will NOT re-add (we filter dismissed)
    removeFromScheduled(item.id);
    try {
      await updateReminderStatus(item.id, 'dismissed');
      setToast({ visible: true, msg: 'Dismissed', undo: async () => updateReminderStatus(item.id, 'scheduled') });
    } catch (_e) {
      // Fallback to hard delete if status update not supported
      try {
        await removeReminder(item.id);
        setToast({ visible: true, msg: 'Dismissed', undo: undefined });
      } catch (e2: any) {
        // revert on failure
        setScheduled(prev => [item, ...prev]);
        Alert.alert('Could not dismiss', e2?.message ?? 'Please try again.');
      }
    }
  }

  // bulk helpers
  async function scheduleAll() {
    if (!pending.length) return;
    const toRun = [...pending];
    // optimistic: clear pending
    setPending([]);
    try {
      for (const r of toRun) await updateReminderStatus(r.id, 'scheduled');
      setToast({ visible: true, msg: `Scheduled ${toRun.length} reminder${toRun.length === 1 ? '' : 's'}` });
    } catch (e: any) {
      // revert if anything fails
      setPending(toRun);
      Alert.alert('Could not schedule all', e?.message ?? 'Please try again.');
    }
  }

  async function deleteAll() {
    if (!pending.length) return;
    const toRun = [...pending];
    Alert.alert('Delete all pending?', `Remove ${toRun.length} reminder${toRun.length === 1 ? '' : 's'}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          // optimistic
          setPending([]);
          try {
            for (const r of toRun) await removeReminder(r.id);
            setToast({ visible: true, msg: 'Pending reminders deleted' });
          } catch (e: any) {
            setPending(toRun);
            Alert.alert('Could not delete all', e?.message ?? 'Please try again.');
          }
        },
      },
    ]);
  }

  const Row = ({ item, isPending }: { item: ReminderDoc; isPending: boolean }) => {
    const swipeRef = useRef<Swipeable>(null);
    const dot = isPending ? t.colors.primary : '#6B7280';

    // Close the row before acting to ensure the tap isn't swallowed by gesture state.
    const closeSwipe = () => swipeRef.current?.close();

    const onScheduleRow = () => { closeSwipe(); onSchedule(item); };
    const onDeleteRow   = () => { closeSwipe(); onDelete(item); };
    const onDismissRow  = () => { closeSwipe(); onDismiss(item); };

    const renderRightActions = (
      _progress: Animated.AnimatedInterpolation<number>,
      _dragX: Animated.AnimatedInterpolation<number>,
    ) => {
      if (isPending) {
        return (
          <View style={s.actionsRow}>
            <ActionButton color={t.colors.primary} label="Schedule" onPress={onScheduleRow} />
            <ActionButton color="#EF4444" label="Delete" onPress={onDeleteRow} />
          </View>
        );
      }
      return (
        <View style={s.actionsRow}>
          <ActionButton color="#6B7280" label="Dismiss" onPress={onDismissRow} />
        </View>
      );
    };

    return (
      <Swipeable
        ref={swipeRef}
        friction={2}
        rightThreshold={40}
        renderRightActions={renderRightActions}
      >
        <Card>
          <View style={s.row}>
            <View style={[s.statusDot, { backgroundColor: dot }]} />
            <View style={{ flex: 1 }}>
              <ThemedText variant="title">{item.title}</ThemedText>
              <ThemedText variant="caption" color={t.colors.textDim}>
                {timeFromISO(item.dueAt)} • {isPending ? 'Pending' : 'Scheduled'}
              </ThemedText>
            </View>

            {isPending ? (
              <>
                <Pressable onPress={onScheduleRow} style={[s.btn, s.btnPrimary]} accessibilityRole="button">
                  <ThemedText variant="button" color="#fff">Schedule</ThemedText>
                </Pressable>
                <Pressable
                  onPress={() =>
                    Alert.alert('Delete?', 'Remove this reminder?', [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Delete', style: 'destructive', onPress: onDeleteRow },
                    ])
                  }
                  style={[s.btn, s.btnGhost]}
                  accessibilityRole="button"
                >
                  <ThemedText variant="button">Delete</ThemedText>
                </Pressable>
              </>
            ) : (
              <Pressable onPress={onDismissRow} style={[s.btn, s.btnGhost]} accessibilityRole="button">
                <ThemedText variant="button">Dismiss</ThemedText>
              </Pressable>
            )}
          </View>
        </Card>
      </Swipeable>
    );
  };

  // build sections based on filter (dismissed are already filtered out)
  const sections = useMemo(() => {
    const base: { title: string; data: ReminderDoc[]; isPending: boolean }[] = [];
    const add = (title: string, data: ReminderDoc[], isPending: boolean) => base.push({ title, data, isPending });

    if (filter === 'all') {
      add('Pending', pending, true);
      add('Scheduled', scheduled, false);
    } else if (filter === 'pending') {
      add('Pending', pending, true);
    } else {
      add('Scheduled', scheduled, false);
    }
    return base;
  }, [filter, pending, scheduled]);

  const empty = !pending.length && !scheduled.length;
  const counts = { pending: pending.length, scheduled: scheduled.length };

  return (
    <Screen scroll={false}>
      <SectionList
        sections={sections}
        keyExtractor={(i) => i.id}
        renderSectionHeader={({ section }) => (
          <ThemedText variant="h2" style={s.section}>
            {section.title}
          </ThemedText>
        )}
        renderItem={({ item, section }) => <Row item={item} isPending={!!section.isPending} />}
        ItemSeparatorComponent={() => <View style={{ height: t.spacing.s }} />}
        ListHeaderComponent={
          <View style={s.header}>
            <ThemedText variant="display">Inbox</ThemedText>
            <ThemedText variant="subtitle" color={t.colors.textDim}>
              Partner reminders for you • Swipe left for actions
            </ThemedText>

            {/* Filter chips */}
            <View style={s.filterRow}>
              {([
                { k: 'all', label: 'All' },
                { k: 'pending', label: `Pending ${counts.pending ? `(${counts.pending})` : ''}` },
                { k: 'scheduled', label: `Scheduled ${counts.scheduled ? `(${counts.scheduled})` : ''}` },
              ] as const).map(({ k, label }) => (
                <Pressable
                  key={k}
                  onPress={() => setFilter(k)}
                  accessibilityRole="button"
                  style={[s.chip, filter === k && s.chipActive]}
                >
                  <ThemedText variant="label" color={filter === k ? t.colors.text : t.colors.textDim}>
                    {label}
                  </ThemedText>
                </Pressable>
              ))}
            </View>

            {/* Bulk actions for pending */}
            {filter !== 'scheduled' && counts.pending > 0 ? (
              <View style={s.bulkRow}>
                <Pressable onPress={scheduleAll} style={[s.bulkBtn, { borderColor: t.colors.border }]}>
                  <ThemedText variant="button">Schedule all</ThemedText>
                </Pressable>
                <Pressable onPress={deleteAll} style={[s.bulkBtn, { borderColor: '#EF4444' }]}>
                  <ThemedText variant="button" color="#EF4444">Delete all</ThemedText>
                </Pressable>
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          empty ? (
            <Card>
              <View style={{ paddingVertical: t.spacing.md }}>
                <ThemedText variant="display">📬</ThemedText>
                <ThemedText variant="title" style={{ marginTop: 6 }}>Nothing here yet</ThemedText>
                <ThemedText variant="caption" color={t.colors.textDim} style={{ marginTop: 6 }}>
                  When your partner creates a shared reminder, it will appear here. You can schedule it, delete it, or dismiss it.
                </ThemedText>
              </View>
            </Card>
          ) : null
        }
        stickySectionHeadersEnabled={false}
        contentContainerStyle={{ paddingBottom: t.spacing.xl }}
      />

      <ToastUndo
        visible={toast.visible}
        message={toast.msg}
        onAction={toast.undo}
        onHide={() => setToast({ visible: false, msg: '' })}
      />
    </Screen>
  );
}

const styles = (t: ThemeTokens) =>
  StyleSheet.create({
    header: {
      paddingHorizontal: t.spacing.md,
      paddingTop: t.spacing.md,
      paddingBottom: t.spacing.s,
    },
    filterRow: {
      flexDirection: 'row',
      gap: 8,
      marginTop: t.spacing.s,
    },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: '#FFFFFF',
      borderWidth: 1,
      borderColor: HAIRLINE,
    },
    chipActive: {
      backgroundColor: t.colors.card,
      borderColor: t.colors.border,
      shadowColor: 'rgba(16,24,40,0.08)',
      shadowOpacity: 1,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 3,
    },
    bulkRow: {
      flexDirection: 'row',
      gap: 10,
      marginTop: t.spacing.s,
    },
    bulkBtn: {
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 12,
      borderWidth: 1,
      backgroundColor: '#FFFFFF',
    },
    section: {
      paddingHorizontal: t.spacing.md,
      marginTop: t.spacing.lg,
      marginBottom: t.spacing.s,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.s,
    },
    statusDot: {
      width: 10,
      height: 10,
      borderRadius: 999,
      marginRight: 2,
    },
    // compact in-row buttons that fit cards
    btn: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: HAIRLINE,
      backgroundColor: '#FFFFFF',
      marginLeft: t.spacing.s,
    },
    btnPrimary: {
      backgroundColor: t.colors.primary,
      borderColor: t.colors.primary,
    },
    btnGhost: {
      backgroundColor: '#FFFFFF',
    },
    actionsRow: {
      width: 180,
      flexDirection: 'row',
      justifyContent: 'flex-end',
      alignItems: 'stretch',
    },
  });

// Styles used only inside ActionButton
const stylesStatic = StyleSheet.create({
  actionBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
});