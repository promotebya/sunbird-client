// screens/TasksScreen.tsx
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  LayoutAnimation,
  Platform,
  Pressable,
  StyleSheet,
  UIManager,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import Button from '../components/Button';
import Card from '../components/Card';
import ConfettiTiny from '../components/ConfettiTiny';
import Input from '../components/Input';
import sharedStyles from '../components/sharedStyles';
import ThemedText from '../components/ThemedText';
import ToastUndo from '../components/ToastUndo';
import { tokens } from '../components/tokens';

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import useAuthListener from '../hooks/useAuthListener';

import { getPairId } from '../utils/partner';
import { createPointsEntry, deletePointsEntry } from '../utils/points';
import { listenDoc, listenQuery } from '../utils/snap';
import { activateCatchup, isoWeekStr, notifyTaskCompletion } from '../utils/streak';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type TaskDoc = {
  id: string;
  title: string;
  ownerId: string;
  pairId?: string | null;
  done?: boolean;
  points?: number;
  createdAt?: any;
  updatedAt?: any;
};

const FIRST_DONE_KEY = (uid: string) =>
  `lp:first-done:${uid}:${new Date().toISOString().slice(0, 10)}`;

const TasksScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { user } = useAuthListener();

  const [pairId, setPairId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<TaskDoc[]>([]);
  const [tab, setTab] = useState<'personal' | 'shared'>('personal');

  const [title, setTitle] = useState('');
  const [titleError, setTitleError] = useState<string | undefined>(undefined);
  const inputRef = useRef<any>(null);

  const [toast, setToast] = useState<{ visible: boolean; msg: string; undo?: () => Promise<void> | void; }>({ visible: false, msg: '' });
  const showUndo = (message: string, undo?: () => Promise<void> | void) => setToast({ visible: true, msg: message, undo });

  const [showConfetti, setShowConfetti] = useState(false);

  const [streak, setStreak] = useState<{
    current?: number;
    longest?: number;
    lastActiveISO?: string;
    todayCount?: number;
    catchupPending?: boolean;
    catchupBaseCurrent?: number;
    catchupWeekISO?: string;
    catchupIntentWeekISO?: string;
  } | null>(null);

  useEffect(() => {
    (async () => {
      if (!user) return setPairId(null);
      const p = await getPairId(user.uid);
      setPairId(p ?? null);
    })();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const qRef = query(
      collection(db, 'tasks'),
      where('ownerId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    const unsub = listenQuery(
      qRef,
      (snap) => {
        const next: TaskDoc[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<TaskDoc, 'id'>) }));
        setTasks(next);
      },
      'tasks'
    );
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const ref = doc(db, 'streaks', user.uid);
    const off = listenDoc(ref, (snap) => setStreak(snap.exists() ? (snap.data() as any) : null), 'streaks');
    return () => off && off();
  }, [user]);

  const personalTasks = useMemo(() => tasks.filter((t) => !t.pairId), [tasks]);
  const sharedTasks = useMemo(() => tasks.filter((t) => !!t.pairId), [tasks]);
  const data = tab === 'personal' ? personalTasks : sharedTasks;

  async function handleAddTask() {
    if (!user) return;
    const trimmed = title.trim();
    if (!trimmed) {
      setTitleError('Please type a task first.');
      return;
    }
    setTitleError(undefined);

    try {
      const payload: Omit<TaskDoc, 'id'> = {
        title: trimmed,
        ownerId: user.uid,
        pairId: tab === 'shared' ? (pairId ?? null) : null,
        done: false,
        points: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await addDoc(collection(db, 'tasks'), payload);
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setTitle('');
      Keyboard.dismiss();
      showUndo('Nice! Added to your list.');
    } catch (e: any) {
      Alert.alert('Couldn’t add task', e?.message ?? 'Please try again.');
    }
  }

  async function maybeShowConfettiOnFirstDone() {
    if (!user) return;
    const key = FIRST_DONE_KEY(user.uid);
    const seen = await AsyncStorage.getItem(key);
    if (!seen) {
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 1200);
      await AsyncStorage.setItem(key, '1');
    }
  }

  async function handleToggleDone(item: TaskDoc) {
    try {
      const nextDone = !item.done;
      await updateDoc(doc(db, 'tasks', item.id), { done: nextDone, updatedAt: serverTimestamp() });
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

      if (nextDone && user) {
        maybeShowConfettiOnFirstDone();
        await notifyTaskCompletion(user.uid).catch(() => {});
      }

      showUndo(nextDone ? 'Marked complete' : 'Marked incomplete', async () => {
        await updateDoc(doc(db, 'tasks', item.id), { done: item.done ?? false, updatedAt: serverTimestamp() });
      });
    } catch (e: any) {
      Alert.alert('Update failed', e?.message ?? 'Please try again.');
    }
  }

  async function handleAwardPoint(item: TaskDoc) {
    if (!user) return;
    try {
      const pointsId = await createPointsEntry({
        ownerId: user.uid,
        pairId: item.pairId ?? null,
        value: 1,
        reason: `Task: ${item.title}`,
        taskId: item.id,
      });

      await updateDoc(doc(db, 'tasks', item.id), {
        points: (item.points ?? 0) + 1,
        updatedAt: serverTimestamp(),
      });

      showUndo('+1 point added 🎉', async () => {
        await deletePointsEntry(pointsId);
        await updateDoc(doc(db, 'tasks', item.id), {
          points: Math.max(0, item.points ?? 0),
          updatedAt: serverTimestamp(),
        });
      });
    } catch (e: any) {
      Alert.alert('Could not award point', e?.message ?? 'Please try again.');
    }
  }

  async function handleDelete(item: TaskDoc) {
    const backup = { ...item };
    try {
      await deleteDoc(doc(db, 'tasks', item.id));
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      showUndo('Task deleted', async () => {
        await addDoc(collection(db, 'tasks'), {
          title: backup.title,
          ownerId: backup.ownerId,
          pairId: backup.pairId ?? null,
          done: backup.done ?? false,
          points: backup.points ?? 0,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });
    } catch (e: any) {
      Alert.alert('Delete failed', e?.message ?? 'Please try again.');
    }
  }

  const renderItem = ({ item }: { item: TaskDoc }) => {
    const done = !!item.done;
    return (
      <Card style={styles.itemCard}>
        <Pressable onPress={() => handleToggleDone(item)} style={styles.itemRow}>
          <View style={[styles.checkbox, done && styles.checkboxOn]}>
            {done ? <Ionicons name="checkmark" size={16} color="#fff" /> : null}
          </View>

          <View style={{ flex: 1 }}>
            <ThemedText variant="body" style={done ? styles.itemDone : undefined}>
              {item.title}
            </ThemedText>
            <View style={styles.metaRow}>
              {typeof item.points === 'number' && item.points > 0 ? (
                <View style={styles.pointsPill}>
                  <ThemedText variant="caption" color="#1E3A8A">
                    +{item.points} pt{item.points === 1 ? '' : 's'}
                  </ThemedText>
                </View>
              ) : (
                <ThemedText variant="caption" color={tokens.colors.textDim}>No points yet</ThemedText>
              )}
            </View>
          </View>

          <Pressable onPress={() => handleAwardPoint(item)} style={styles.awardBtn}>
            <Ionicons name="add-circle" size={20} color={tokens.colors.primary} />
          </Pressable>

          <Pressable onPress={() => handleDelete(item)} style={styles.deleteBtn}>
            <Ionicons name="trash-outline" size={20} color="#EF4444" />
          </Pressable>
        </Pressable>
      </Card>
    );
  };

  const showCatchupChip = useMemo(() => {
    if (!streak) return true;
    const thisWeek = isoWeekStr(new Date());
    const alreadyUsedThisWeek = streak.catchupWeekISO === thisWeek;
    const alreadyArmedThisWeek = streak.catchupIntentWeekISO === thisWeek;
    const pending = !!streak.catchupPending;
    return !alreadyUsedThisWeek && !alreadyArmedThisWeek && !pending;
  }, [streak]);

  return (
    <SafeAreaView style={[sharedStyles.screen, { paddingTop: tokens.spacing.md }]} edges={['top', 'left', 'right']}>
      {showConfetti ? <ConfettiTiny /> : null}

      <KeyboardAvoidingView behavior={Platform.select({ ios: 'padding', android: undefined })} style={{ flex: 1 }}>
        {/* Header */}
        <View style={styles.header}>
          <ThemedText variant="display">Tasks</ThemedText>
          <ThemedText variant="subtitle" color={tokens.colors.textDim}>
            Keep track of kind little things
          </ThemedText>
        </View>

        {/* Tabs */}
        <View style={styles.chips}>
          <Pressable style={[styles.tabChip, tab === 'personal' && styles.tabChipActive]} onPress={() => setTab('personal')}>
            <ThemedText variant="label" color={tab === 'personal' ? tokens.colors.buttonTextPrimary : tokens.colors.textDim}>Personal</ThemedText>
          </Pressable>
          <Pressable style={[styles.tabChip, tab === 'shared' && styles.tabChipActive]} onPress={() => setTab('shared')}>
            <ThemedText variant="label" color={tab === 'shared' ? tokens.colors.buttonTextPrimary : tokens.colors.textDim}>Shared</ThemedText>
          </Pressable>
        </View>

        {/* Catch-up helper */}
        {showCatchupChip && (
          <View style={{ paddingHorizontal: tokens.spacing.md, marginBottom: tokens.spacing.s }}>
            <Pressable
              onPress={async () => {
                if (!user) return;
                await activateCatchup(user.uid);
                showUndo('Catch-up armed for this week');
              }}
              style={styles.catchupChip}
            >
              <Ionicons name="sparkles" size={14} color="#92400E" />
              <ThemedText variant="label" color="#92400E" style={{ marginLeft: 6 }}>
                Catch-up day
              </ThemedText>
            </Pressable>
            <ThemedText variant="caption" color={tokens.colors.textDim} style={{ marginTop: 4 }}>
              Missed yesterday? Complete 2 tasks today to keep your streak.
            </ThemedText>
          </View>
        )}

        {/* Composer */}
        <Card style={{ marginBottom: tokens.spacing.md }}>
          <View style={styles.inputRow}>
            <Input
              ref={inputRef}
              value={title}
              onChangeText={(t) => {
                setTitle(t);
                if (titleError) setTitleError(undefined);
              }}
              placeholder="New task…"
              containerStyle={{ flex: 1, marginRight: tokens.spacing.s }}
              errorText={titleError}
              returnKeyType="done"
              onSubmitEditing={handleAddTask}
            />
            <Button label="Add" onPress={handleAddTask} />
          </View>

          {/* Suggestions */}
          <View style={styles.suggestWrap}>
            {['Plan a mini date', 'Write a love note', 'Make coffee', 'Do the dishes', 'Book a walk', 'Bring a snack'].map((s) => (
              <Pressable key={s} onPress={() => setTitle(s)} style={styles.suggestChip}>
                <ThemedText variant="label">{s}</ThemedText>
              </Pressable>
            ))}
          </View>
        </Card>

        {/* List */}
        <FlatList
          data={data}
          keyExtractor={(i) => i.id}
          ItemSeparatorComponent={() => <View style={{ height: tokens.spacing.s }} />}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: insets.bottom + tokens.spacing.xl }}
          ListEmptyComponent={
            <Card>
              <View style={{ alignItems: 'center', paddingVertical: tokens.spacing.lg }}>
                <ThemedText variant="display">📝</ThemedText>
                <ThemedText variant="title" style={{ marginTop: tokens.spacing.xs }}>
                  No tasks yet
                </ThemedText>
                <ThemedText variant="caption" color={tokens.colors.textDim} style={{ marginTop: tokens.spacing.xs }}>
                  Try adding ‘Plan a surprise’ 😉
                </ThemedText>
                <Pressable onPress={() => inputRef.current?.focus()} style={styles.emptyBtn}>
                  <ThemedText variant="button" color="#fff">Add a task</ThemedText>
                </Pressable>
              </View>
            </Card>
          }
        />

        <ToastUndo
          visible={toast.visible}
          message={toast.msg}
          onAction={toast.undo}
          onHide={() => setToast({ visible: false, msg: '' })}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  header: { padding: tokens.spacing.md, paddingBottom: tokens.spacing.s },

  // unified chips like Challenges
  chips: {
    flexDirection: 'row',
    gap: tokens.spacing.s as number,
    paddingHorizontal: tokens.spacing.md,
    marginBottom: tokens.spacing.md,
  },
  tabChip: {
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: 8,
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    borderColor: tokens.colors.cardBorder,
    backgroundColor: tokens.colors.card,
  },
  tabChipActive: {
    backgroundColor: tokens.colors.primary,
    borderColor: tokens.colors.primary,
  },

  catchupChip: {
    alignSelf: 'flex-start',
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
    borderWidth: 1,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: 8,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
  },

  inputRow: { flexDirection: 'row', alignItems: 'center' },

  suggestWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing.s as number,
    marginTop: tokens.spacing.s,
  },
  suggestChip: {
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#ECEFF3',
  },

  itemCard: { marginHorizontal: tokens.spacing.md },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.s as number },

  checkbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#E5E7EB',
    alignItems: 'center', justifyContent: 'center', marginRight: tokens.spacing.s,
  },
  checkboxOn: { backgroundColor: tokens.colors.primary, borderColor: tokens.colors.primary },
  itemDone: { textDecorationLine: 'line-through', color: tokens.colors.textDim },

  metaRow: { marginTop: 2 },
  pointsPill: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999,
    backgroundColor: '#DBEAFE', borderWidth: 1, borderColor: '#BFDBFE',
    alignSelf: 'flex-start',
  },

  awardBtn: {
    paddingHorizontal: 6, paddingVertical: 6, borderRadius: 8,
    backgroundColor: tokens.colors.card, borderWidth: 1, borderColor: '#FCE7F3',
  },
  deleteBtn: {
    marginLeft: 6, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 8,
    backgroundColor: tokens.colors.card, borderWidth: 1, borderColor: '#F3F4F6',
  },

  emptyBtn: {
    marginTop: tokens.spacing.md,
    backgroundColor: tokens.colors.primary,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: 10,
    borderRadius: tokens.radius.md,
  },
});

export default TasksScreen;
