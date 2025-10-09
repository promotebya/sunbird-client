// screens/TasksScreen.tsx
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useRoute } from '@react-navigation/native';
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
import ThemedText from '../components/ThemedText';
import { useTokens, type ThemeTokens } from '../components/ThemeProvider';
import ToastUndo from '../components/ToastUndo';

// Spotlight
import {
  SpotlightAutoStarter,
  SpotlightTarget,
  type SpotlightStep,
} from '../components/spotlight';

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
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

// Rewards quick-add from Tasks
import RedeemModal from '../components/RedeemModal';
import { addReward } from '../utils/rewards';

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

// theme utility
function withAlpha(hex: string, alpha: number) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const a = Math.round(alpha * 255).toString(16).padStart(2, '0');
  return `#${full}${a}`;
}

const TasksScreen: React.FC = () => {
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const { user } = useAuthListener();
  const t = useTokens();
  const s = useMemo(() => styles(t), [t]);

  const [pairId, setPairId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<TaskDoc[]>([]);

  const [title, setTitle] = useState('');
  const [titleError, setTitleError] = useState<string | undefined>(undefined);
  const inputRef = useRef<any>(null);

  const [toast, setToast] = useState<{ visible: boolean; msg: string; undo?: () => Promise<void> | void; }>({ visible: false, msg: '' });
  const showUndo = (message: string, undo?: () => Promise<void> | void) => setToast({ visible: true, msg: message, undo });

  const [showConfetti, setShowConfetti] = useState(false);
  const [showAddReward, setShowAddReward] = useState(false);

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

  // Accept preset idea from Home: nav.navigate('Tasks', { presetIdea: '...' })
  useEffect(() => {
    const preset: string | undefined = route.params?.presetIdea;
    if (preset) {
      setTitle(preset);
      requestAnimationFrame(() => inputRef.current?.focus?.());
      nav.setParams?.({ presetIdea: undefined });
    }
  }, [route.params, nav]);

  // Load pairId
  useEffect(() => {
    (async () => {
      if (!user) return setPairId(null);
      const p = await getPairId(user.uid);
      setPairId(p ?? null);
    })();
  }, [user]);

  // Shared-only listener (both partners see)
  useEffect(() => {
    if (!user || !pairId) {
      setTasks([]);
      return;
    }
    const qRef = query(
      collection(db, 'tasks'),
      where('pairId', '==', pairId),
      orderBy('createdAt', 'desc')
    );
    const unsub = listenQuery(
      qRef,
      (snap) => {
        const next: TaskDoc[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<TaskDoc, 'id'>) }));
        setTasks(next);
      },
      'tasks:shared'
    );
    return () => unsub();
  }, [user, pairId]);

  // Migrate recent orphan tasks (pairId == null) to current pair after link (best-effort)
  useEffect(() => {
    (async () => {
      if (!user || !pairId) return;
      try {
        const qRef = query(
          collection(db, 'tasks'),
          where('ownerId', '==', user.uid),
          orderBy('createdAt', 'desc'),
          limit(50)
        );
        const snap = await getDocs(qRef);
        const orphan = snap.docs.filter(d => (d.data() as any)?.pairId == null);
        await Promise.all(
          orphan.map(d => updateDoc(doc(db, 'tasks', d.id), { pairId, updatedAt: serverTimestamp() }))
        );
      } catch {
        // ignore
      }
    })();
  }, [user, pairId]);

  // Streak doc
  useEffect(() => {
    if (!user) return;
    const ref = doc(db, 'streaks', user.uid);
    const off = listenDoc(ref, (snap) => setStreak(snap.exists() ? (snap.data() as any) : null), 'streaks');
    return () => off && off();
  }, [user]);

  async function handleAddTask() {
    if (!user) return;
    const trimmed = title.trim();
    if (!trimmed) {
      setTitleError('Please type a task first.');
      return;
    }
    if (!pairId) {
      Alert.alert('Link accounts first', 'Open Pairing to link with your partner before adding shared tasks.');
      return;
    }
    setTitleError(undefined);

    try {
      const payload: Omit<TaskDoc, 'id'> = {
        title: trimmed,
        ownerId: user.uid,
        pairId,            // shared-only
        done: false,
        points: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await addDoc(collection(db, 'tasks'), payload);
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setTitle('');
      Keyboard.dismiss();
      showUndo('Nice! Added to the shared list.');
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
          points: Math.max(0, (item.points ?? 0)),
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
          pairId: backup.pairId ?? pairId ?? null,
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

  const onCreateReward = async (title: string, cost: number) => {
    if (!user) return;
    try {
      await addReward(user.uid, pairId ?? null, title, cost);
    } catch (e: any) {
      Alert.alert('Could not add reward', e?.message ?? 'Please try again.');
    }
  };

  // Spotlight steps (shared-only)
  const TASKS_TOUR_STEPS: SpotlightStep[] = useMemo(() => {
    const steps: SpotlightStep[] = [
      {
        id: 'tsk-welcome',
        targetId: null,
        title: 'Shared Tasks',
        text: 'Both partners see and update this list.',
        placement: 'bottom',
        allowBackdropTapToNext: true,
      },
      { id: 'tsk-input', targetId: 'ts-input', title: 'Add a task', text: 'Type a small, kind action.' },
      { id: 'tsk-add', targetId: 'ts-add', title: 'Save it', text: 'Tap Add to put it on the list.', placement: 'top' },
      { id: 'tsk-suggestions', targetId: 'ts-suggestions', title: 'Ideas', text: 'Tap a suggestion to prefill.' },
    ];
    if (tasks.length > 0) {
      steps.push(
        { id: 'tsk-done',   targetId: 'ts-done',   title: 'Mark complete', text: 'Tap the box when you’re done.' },
        { id: 'tsk-award',  targetId: 'ts-award',  title: 'Give a point',  text: 'Reward effort with +1.', placement: 'top' },
        { id: 'tsk-delete', targetId: 'ts-delete', title: 'Delete',        text: 'Remove things you don’t need.', placement: 'top' },
      );
    }
    return steps;
  }, [tasks.length]);

  const renderItem = ({ item, index }: { item: TaskDoc; index: number }) => {
    const done = !!item.done;
    const isFirst = index === 0;

    const Checkbox = (
      <View style={[s.checkbox, done && { backgroundColor: t.colors.primary, borderColor: t.colors.primary }]}>
        {done ? <Ionicons name="checkmark" size={16} color="#fff" /> : null}
      </View>
    );
    const AwardBtn = (
      <Pressable onPress={() => handleAwardPoint(item)} style={s.awardBtn} hitSlop={8} accessibilityLabel="Add point">
        <Ionicons name="add-circle" size={20} color={t.colors.primary} />
      </Pressable>
    );
    const DeleteBtn = (
      <Pressable onPress={() => handleDelete(item)} style={s.deleteBtn} hitSlop={8} accessibilityLabel="Delete task">
        <Ionicons name="trash-outline" size={20} color="#EF4444" />
      </Pressable>
    );

    return (
      <Card style={s.itemCard}>
        <Pressable onPress={() => handleToggleDone(item)} style={s.itemRow} accessibilityRole="button">
          {isFirst ? <SpotlightTarget id="ts-done">{Checkbox}</SpotlightTarget> : Checkbox}

          <View style={{ flex: 1 }}>
            <ThemedText variant="title" color={done ? t.colors.textDim : t.colors.text}>
              {item.title}
            </ThemedText>
            <View style={s.metaRow}>
              {typeof item.points === 'number' && item.points > 0 ? (
                <View style={s.pointsPill}>
                  <ThemedText variant="caption" color={t.colors.primary}>
                    +{item.points} pt{item.points === 1 ? '' : 's'}
                  </ThemedText>
                </View>
              ) : (
                <ThemedText variant="caption" color={t.colors.textDim}>No points yet</ThemedText>
              )}
            </View>
          </View>

          {isFirst ? <SpotlightTarget id="ts-award">{AwardBtn}</SpotlightTarget> : AwardBtn}
          {isFirst ? <SpotlightTarget id="ts-delete">{DeleteBtn}</SpotlightTarget> : DeleteBtn}
        </Pressable>
      </Card>
    );
  };

  const showCatchupChip = useMemo(() => {
    if (!streak) return true;
    const thisWeek = isoWeekStr(new Date());
    const alreadyUsedThisWeek  = streak.catchupWeekISO === thisWeek;
    const alreadyArmedThisWeek = streak.catchupIntentWeekISO === thisWeek;
    const pending = !!streak.catchupPending;
    return !alreadyUsedThisWeek && !alreadyArmedThisWeek && !pending;
  }, [streak]);

  // Everything above the list now scrolls with the list
  const listHeader = (
    <View>
      {/* Header */}
      <View style={[s.header, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
        <View>
          <ThemedText variant="display">Shared tasks</ThemedText>
        </View>
        <Button label="Add reward" variant="outline" onPress={() => setShowAddReward(true)} />
      </View>

      {!pairId && (
        <Card style={{ marginHorizontal: t.spacing.md, marginBottom: t.spacing.md, paddingVertical: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: t.spacing.md }}>
            <View
              style={{
                width: 36, height: 36, borderRadius: 10,
                backgroundColor: withAlpha(t.colors.primary, 0.08),
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Ionicons name="link" size={18} color={t.colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText variant="title">Link with your partner</ThemedText>
              <ThemedText variant="caption" color={t.colors.textDim}>Share tasks and progress.</ThemedText>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 10, paddingHorizontal: t.spacing.md }}>
            <Button label="Link now" onPress={() => nav.navigate('Pairing')} />
          </View>
        </Card>
      )}

      {/* Catch-up helper */}
      {showCatchupChip && (
        <View style={{ paddingHorizontal: t.spacing.md, marginBottom: t.spacing.s }}>
          <SpotlightTarget id="ts-catchup">
            <Pressable
              onPress={async () => {
                if (!user) return;
                await activateCatchup(user.uid);
                showUndo('Catch-up armed for this week');
              }}
              style={s.catchupChip}
            >
              <Ionicons name="sparkles" size={14} color={t.colors.primary} />
              <ThemedText variant="label" color={t.colors.primary} style={{ marginLeft: 6 }}>
                Catch-up day
              </ThemedText>
            </Pressable>
          </SpotlightTarget>
          <ThemedText variant="caption" color={t.colors.textDim} style={{ marginTop: 4 }}>
            Missed yesterday? Complete 2 tasks today to keep your streak.
          </ThemedText>
        </View>
      )}

      {/* Composer */}
      <Card style={{ marginBottom: t.spacing.md }}>
        <View style={s.inputRow}>
          <SpotlightTarget id="ts-input">
            <Input
              ref={inputRef}
              value={title}
              onChangeText={(val) => {
                setTitle(val);
                if (titleError) setTitleError(undefined);
              }}
              placeholder="New shared task…"
              containerStyle={{ flex: 1, marginRight: t.spacing.s }}
              errorText={titleError}
              editable={!!pairId}
              returnKeyType="done"
              onSubmitEditing={handleAddTask}
            />
          </SpotlightTarget>
          <SpotlightTarget id="ts-add">
            <Button label="Add" onPress={handleAddTask} disabled={!title.trim() || !pairId} />
          </SpotlightTarget>
        </View>

        {/* Quick ideas */}
        <ThemedText variant="caption" color={t.colors.textDim} style={{ marginTop: t.spacing.s }}>
          Tap to add to your list.
        </ThemedText>
        <SpotlightTarget id="ts-suggestions">
          <View style={s.suggestWrap}>
            {['Plan a mini date', 'Write a love note', 'Make coffee', 'Do the dishes', 'Share a song', 'Bring a snack'].map((txt) => (
              <Pressable key={txt} onPress={() => setTitle(txt)} style={s.suggestChip} accessibilityRole="button">
                <ThemedText variant="label">{txt}</ThemedText>
              </Pressable>
            ))}
          </View>
        </SpotlightTarget>
      </Card>
    </View>
  );

  return (
    <SafeAreaView style={[s.screen, { paddingTop: t.spacing.md }]} edges={['top', 'left', 'right']}>
      {showConfetti ? <ConfettiTiny /> : null}

      <KeyboardAvoidingView behavior={Platform.select({ ios: 'padding', android: undefined })} style={{ flex: 1 }}>
        <FlatList
          data={tasks}
          keyExtractor={(i) => i.id}
          ItemSeparatorComponent={() => <View style={{ height: t.spacing.s }} />}
          renderItem={renderItem}
          ListHeaderComponent={listHeader}
          contentContainerStyle={{ paddingBottom: insets.bottom + t.spacing.xl }}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <Card>
              <View style={{ alignItems: 'center', paddingVertical: t.spacing.lg }}>
                <ThemedText variant="display">📝</ThemedText>
                <ThemedText variant="title" style={{ marginTop: t.spacing.xs }}>
                  No shared tasks yet
                </ThemedText>
                <ThemedText variant="caption" color={t.colors.textDim} style={{ marginTop: t.spacing.xs }}>
                  Try adding ‘Plan a surprise’ 😉
                </ThemedText>
                <View style={{ marginTop: t.spacing.md }}>
                  <Button label="Add a task" onPress={() => inputRef.current?.focus()} disabled={!pairId} />
                </View>
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

        {/* Add reward modal */}
        <RedeemModal
          visible={showAddReward}
          onClose={() => setShowAddReward(false)}
          onCreate={onCreateReward}
        />

        {/* Auto-start tutorial */}
        <SpotlightAutoStarter uid={user?.uid ?? null} steps={TASKS_TOUR_STEPS} persistKey="tour-tasks-shared-only" />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = (t: ThemeTokens) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.colors.bg },

    header: { padding: t.spacing.md, paddingBottom: t.spacing.s },

    // Catch-up chip: derive tint from primary (theme-safe)
    catchupChip: {
      alignSelf: 'flex-start',
      backgroundColor: withAlpha(t.colors.primary, 0.10),
      borderColor: withAlpha(t.colors.primary, 0.22),
      borderWidth: 1,
      paddingHorizontal: t.spacing.md,
      paddingVertical: 8,
      borderRadius: 999,
      flexDirection: 'row',
      alignItems: 'center',
    },

    inputRow: { flexDirection: 'row', alignItems: 'center' },

    suggestWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: t.spacing.s as number,
      marginTop: t.spacing.s,
    },
    suggestChip: {
      paddingHorizontal: t.spacing.md,
      paddingVertical: 10,
      borderRadius: 999,
      backgroundColor: t.colors.card,
      borderWidth: 1,
      borderColor: t.colors.border,
    },

    itemCard: { marginHorizontal: t.spacing.md },
    itemRow: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.s as number },

    checkbox: {
      width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: t.colors.border,
      alignItems: 'center', justifyContent: 'center', marginRight: t.spacing.s,
    },

    metaRow: { marginTop: 2 },

    pointsPill: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor: withAlpha(t.colors.primary, 0.14),
      borderWidth: 1,
      borderColor: withAlpha(t.colors.primary, 0.28),
      alignSelf: 'flex-start',
    },

    awardBtn: {
      paddingHorizontal: 6,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: t.colors.card,
      borderWidth: 1,
      borderColor: withAlpha(t.colors.primary, 0.25),
    },
    deleteBtn: {
      marginLeft: 6,
      paddingHorizontal: 8,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: t.colors.card,
      borderWidth: 1,
      borderColor: t.colors.border,
    },
  });

export default TasksScreen;