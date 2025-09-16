// screens/RemindersInboxScreen.tsx
import { addDoc, collection } from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Pressable, SectionList, StyleSheet, View } from 'react-native';
import { RectButton, Swipeable } from 'react-native-gesture-handler';
import Card from '../components/Card';
import sharedStyles from '../components/sharedStyles';
import ThemedText from '../components/ThemedText';
import ToastUndo from '../components/ToastUndo';
import { tokens } from '../components/tokens';
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

const ActionButton = ({
  color,
  label,
  onPress,
}: {
  color: string;
  label: string;
  onPress: () => void;
}) => (
  <RectButton onPress={onPress} style={[styles.actionBtn, { backgroundColor: color }]}>
    <ThemedText variant="button" color="#fff" center>
      {label}
    </ThemedText>
  </RectButton>
);

export default function RemindersInboxScreen() {
  const { user } = useAuthListener();
  const [pending, setPending] = useState<ReminderDoc[]>([]);
  const [scheduled, setScheduled] = useState<ReminderDoc[]>([]);

  const [toast, setToast] = useState<{ visible: boolean; msg: string; undo?: () => Promise<void> | void; }>({
    visible: false,
    msg: '',
  });

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeRemindersForUid(user.uid, (p, s) => {
      setPending(p);
      setScheduled(s);
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
        <View style={styles.actionsRow}>
          <ActionButton color={tokens.colors.primary} label="Schedule" onPress={() => onSchedule(item)} />
          <ActionButton color="#EF4444" label="Delete" onPress={() => onDelete(item)} />
        </View>
      );
    }
    return (
      <View style={styles.actionsRow}>
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
        renderRightActions={(progress, dragX) => renderRightActions(progress, dragX, item, isPending)}
      >
        <Card>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <ThemedText variant="title">{item.title}</ThemedText>
              <ThemedText variant="caption" color={tokens.colors.textDim}>
                Due {timeFromISO(item.dueAt)} • {isPending ? 'Pending' : 'Scheduled'}
              </ThemedText>
            </View>

            {isPending ? (
              <>
                <Pressable onPress={() => onSchedule(item)} style={[styles.btn, styles.btnPrimary]}>
                  <ThemedText variant="button" color={tokens.colors.buttonTextPrimary}>Schedule</ThemedText>
                </Pressable>
                <Pressable
                  onPress={() =>
                    Alert.alert('Delete?', 'Remove this reminder?', [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Delete', style: 'destructive', onPress: () => onDelete(item) },
                    ])
                  }
                  style={[styles.btn, styles.btnGhost]}
                >
                  <ThemedText variant="button">Delete</ThemedText>
                </Pressable>
              </>
            ) : (
              <Pressable onPress={() => onDismiss(item)} style={[styles.btn, styles.btnGhost]}>
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

  return (
    <View style={sharedStyles.screen}>
      <SectionList
        sections={sections}
        keyExtractor={(i) => i.id}
        renderSectionHeader={({ section }) => (
          <ThemedText variant="h2" style={styles.section}>
            {section.title}
          </ThemedText>
        )}
        renderItem={({ item, section }) => <Row item={item} isPending={!!section.isPending} />}
        ItemSeparatorComponent={() => <View style={{ height: tokens.spacing.s }} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <ThemedText variant="display">Inbox</ThemedText>
            <ThemedText variant="subtitle" color={tokens.colors.textDim}>Partner reminders for you</ThemedText>
          </View>
        }
        stickySectionHeadersEnabled={false}
        contentContainerStyle={{ paddingBottom: tokens.spacing.xl }}
      />

      <ToastUndo
        visible={toast.visible}
        message={toast.msg}
        onAction={toast.undo}
        onHide={() => setToast({ visible: false, msg: '' })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: tokens.spacing.md, paddingTop: tokens.spacing.md, paddingBottom: tokens.spacing.s },
  section: { paddingHorizontal: tokens.spacing.md, marginTop: tokens.spacing.lg, marginBottom: tokens.spacing.s },
  row: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.s as unknown as number },
  btn: {
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.s,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginLeft: tokens.spacing.s,
  },
  btnPrimary: { backgroundColor: tokens.colors.primary, borderColor: tokens.colors.primary },
  btnGhost: { backgroundColor: tokens.colors.card },
  actionsRow: { width: 180, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'stretch' },
  actionBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: tokens.spacing.s },
});
