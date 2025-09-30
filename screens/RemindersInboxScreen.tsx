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

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeRemindersForUid(user.uid, (p, sList) => {
      setPending(p);
      setScheduled(sList);
    });
    return () => unsub && unsub();
  }, [user]);

  const renderRightActions = (
    _progress: Animated.AnimatedInterpolation<number>,
    _dragX: Animated.AnimatedInterpolation<number>,
    item: ReminderDoc,
    isPending: boolean
  ) => {
    if (isPending) {
      return (
        <View style={s.actionsRow}>
          <ActionButton color={t.colors.primary} label="Schedule" onPress={() => onSchedule(item)} />
          <ActionButton color="#EF4444" label="Delete" onPress={() => onDelete(item)} />
        </View>
      );
    }
    return (
      <View style={s.actionsRow}>
        <ActionButton color="#6B7280" label="Dismiss" onPress={() => onDismiss(item)} />
      </View>
    );
  };

  async function onSchedule(item: ReminderDoc) {
    await updateReminderStatus(item.id, 'scheduled');
    setToast({ visible: true, msg: 'Scheduled', undo: async () => updateReminderStatus(item.id, 'pending') });
  }

  async function onDelete(item: ReminderDoc) {
    const backup = item;
    await removeReminder(item.id);
    setToast({
      visible: true,
      msg: 'Reminder deleted',
      undo: async () => {
        const { id, ...payload } = backup as any;
        await addDoc(collection(db, 'reminders'), { ...payload, status: 'pending' });
      },
    });
  }

  async function onDismiss(item: ReminderDoc) {
    await updateReminderStatus(item.id, 'dismissed');
    setToast({ visible: true, msg: 'Dismissed', undo: async () => updateReminderStatus(item.id, 'scheduled') });
  }

  // bulk helpers to make the screen purposeful
  async function scheduleAll() {
    if (!pending.length) return;
    for (const r of pending) await updateReminderStatus(r.id, 'scheduled');
    setToast({ visible: true, msg: `Scheduled ${pending.length} reminder${pending.length === 1 ? '' : 's'}` });
  }
  async function deleteAll() {
    if (!pending.length) return;
    Alert.alert('Delete all pending?', `Remove ${pending.length} reminder${pending.length === 1 ? '' : 's'}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          for (const r of pending) await removeReminder(r.id);
          setToast({ visible: true, msg: 'Pending reminders deleted' });
        },
      },
    ]);
  }

  const Row = ({ item, isPending }: { item: ReminderDoc; isPending: boolean }) => {
    const swipeRef = useRef<Swipeable>(null);
    const dot = isPending ? t.colors.primary : '#6B7280';
    return (
      <Swipeable
        ref={swipeRef}
        friction={2}
        rightThreshold={40}
        renderRightActions={(progress, dragX) =>
          renderRightActions(progress, dragX, item, isPending)
        }
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
                <Pressable onPress={() => onSchedule(item)} style={[s.btn, s.btnPrimary]} accessibilityRole="button">
                  <ThemedText variant="button" color="#fff">Schedule</ThemedText>
                </Pressable>
                <Pressable
                  onPress={() =>
                    Alert.alert('Delete?', 'Remove this reminder?', [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Delete', style: 'destructive', onPress: () => onDelete(item) },
                    ])
                  }
                  style={[s.btn, s.btnGhost]}
                  accessibilityRole="button"
                >
                  <ThemedText variant="button">Delete</ThemedText>
                </Pressable>
              </>
            ) : (
              <Pressable onPress={() => onDismiss(item)} style={[s.btn, s.btnGhost]} accessibilityRole="button">
                <ThemedText variant="button">Dismiss</ThemedText>
              </Pressable>
            )}
          </View>
        </Card>
      </Swipeable>
    );
  };

  // build sections based on filter
  const sections = useMemo(() => {
    const base: { title: string; data: ReminderDoc[]; isPending: boolean }[] = [];
    const add = (title: string, data: ReminderDoc[], isPending: boolean) => base.push({ title, data, isPending });

    if (filter === 'all') {
      add('Pending', pending, true);
      add('Scheduled / Handled', scheduled, false);
    } else if (filter === 'pending') {
      add('Pending', pending, true);
    } else {
      add('Scheduled / Handled', scheduled, false);
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