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
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Porcelain neutrals (match other screens)
const HAIRLINE = '#F0E6EF';
const CHIP_BG  = '#F3EEF6';

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

  const Row = ({ item, isPending }: { item: ReminderDoc; isPending: boolean }) => {
    const swipeRef = useRef<Swipeable>(null);
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
            <View style={{ flex: 1 }}>
              <ThemedText variant="title">{item.title}</ThemedText>
              <ThemedText variant="caption" color={t.colors.textDim}>
                Due {timeFromISO(item.dueAt)} • {isPending ? 'Pending' : 'Scheduled'}
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

  const sections = [
    { title: 'Pending', data: pending, isPending: true },
    { title: 'Scheduled / Handled', data: scheduled, isPending: false },
  ];

  const empty = !pending.length && !scheduled.length;

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
          </View>
        }
        ListEmptyComponent={
          empty ? (
            <Card>
              <ThemedText variant="title">Nothing here yet</ThemedText>
              <ThemedText variant="caption" color={t.colors.textDim} style={{ marginTop: 6 }}>
                When your partner creates a shared reminder, it will appear here.
              </ThemedText>
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

// Styles used only inside ActionButton (static so we can create outside the hook)
const stylesStatic = StyleSheet.create({
  actionBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
});