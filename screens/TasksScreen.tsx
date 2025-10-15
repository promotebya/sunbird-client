// screens/TasksScreen.tsx
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  DeviceEventEmitter,
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
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import useAuthListener from '../hooks/useAuthListener';
import usePointsTotal from '../hooks/usePointsTotal';

// import { getPairId } from '../utils/partner';
import { createPointsEntry, deletePointsEntry } from '../utils/points';
import { listenDoc } from '../utils/snap';
import { activateCatchup, isoWeekStr, notifyTaskCompletion } from '../utils/streak';

import RedeemModal from '../components/RedeemModal';
import { addReward, listenRewards, redeemReward, type RewardDoc } from '../utils/rewards';

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
  const { total } = usePointsTotal(user?.uid); // fallback only
  const t = useTokens();
  const s = useMemo(() => styles(t), [t]);

  const [pairId, setPairId] = useState<string | null>(null);
  const prevPairRef = useRef<string | null>(null);
  const [tasks, setTasks] = useState<TaskDoc[]>([]);
  const [rewards, setRewards] = useState<RewardDoc[]>([]);

  const [title, setTitle] = useState('');
  const [titleError, setTitleError] = useState<string | undefined>(undefined);
  const inputRef = useRef<any>(null);

  const [toast, setToast] = useState<{ visible: boolean; msg: string; undo?: () => Promise<void> | void; }>({ visible: false, msg: '' });
  const showUndo = (message: string, undo?: () => Promise<void> | void) => setToast({ visible: true, msg: message, undo });

  const [showConfetti, setShowConfetti] = useState(false);
  const [showAddReward, setShowAddReward] = useState(false);

  // Persisted fold state for the Rewards section
  const REWARDS_OPEN_KEY = (uid?: string | null) => `lp:tasks:rewardsOpen:${uid ?? 'anon'}`;
  const [rewardsOpen, setRewardsOpen] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(REWARDS_OPEN_KEY(user?.uid));
        if (stored === '0') setRewardsOpen(false);
        else if (stored === '1') setRewardsOpen(true);
      } catch {}
    })();
  }, [user?.uid]);

  useEffect(() => {
    (async () => {
      try {
        await AsyncStorage.setItem(REWARDS_OPEN_KEY(user?.uid), rewardsOpen ? '1' : '0');
      } catch {}
    })();
  }, [rewardsOpen, user?.uid]);

  const toggleRewardsOpen = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setRewardsOpen((v) => !v);
  };

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

  // Accept preset idea
  useEffect(() => {
    const preset: string | undefined = route.params?.presetIdea;
    if (preset) {
      setTitle(preset);
      requestAnimationFrame(() => inputRef.current?.focus?.());
      nav.setParams?.({ presetIdea: undefined });
    }
  }, [route.params, nav]);

  // Live pairId from user doc
  useEffect(() => {
    if (!user?.uid) {
      setPairId(null);
      return;
    }
    const ref = doc(db, 'users', user.uid);
    const off = listenDoc(ref, (snap) => {
      const nextPair: string | null = snap.exists() ? ((snap.data() as any)?.pairId ?? null) : null;
      setPairId(nextPair);
    }, 'user:pairId');
    return () => off && off();
  }, [user?.uid]);

  // Cleanup on unlink: tasks + rewards
  useEffect(() => {
    if (!user?.uid) {
      prevPairRef.current = null;
      return;
    }
    const prev = prevPairRef.current;
    if (prev && pairId == null) {
      void cleanupTasksForPreviousPair(prev, user.uid);
      void cleanupRewardsForPreviousPair(prev, user.uid);
      // Make UI drop immediately (Android sometimes keeps last snapshot briefly)
      setTasks([]);
      setRewards([]);
    }
    prevPairRef.current = pairId ?? null;
  }, [pairId, user?.uid]);

  async function cleanupTasksForPreviousPair(prevPairId: string, uid: string) {
    try {
      const marker = `lp:tasks-cleaned:${prevPairId}:${uid}`;
      const done = await AsyncStorage.getItem(marker);
      if (done) return;

      const col = collection(db, 'tasks');

      // Delete MY tasks for that old pair
      const mineSnap = await getDocs(query(col, where('ownerId', '==', uid), limit(500)));
      const mineToDelete = mineSnap.docs
        .filter(d => (d.data() as any)?.pairId === prevPairId)
        .map(d => d.id);
      await deleteInChunks(mineToDelete);

      // Best-effort: delete any remaining shared tasks (may be denied; ignore)
      try {
        const sharedSnap = await getDocs(query(col, where('pairId', '==', prevPairId)));
        const sharedIds = sharedSnap.docs.map(d => d.id);
        await deleteInChunks(sharedIds);
      } catch (e: any) {
        console.warn('[tasks cleanup] shared delete skipped:', e?.code ?? e?.message ?? e);
      }

      await AsyncStorage.setItem(marker, '1');
    } catch (e) {
      console.warn('[tasks cleanup] error', e);
    }
  }

  // Rewards cleanup mirrors tasks cleanup
  async function cleanupRewardsForPreviousPair(prevPairId: string, uid: string) {
    try {
      const marker = `lp:rewards-cleaned:${prevPairId}:${uid}`;
      const done = await AsyncStorage.getItem(marker);
      if (done) return;

      const col = collection(db, 'rewards');

      // Delete MY rewards for that old pair (safe)
      const mineSnap = await getDocs(query(col, where('ownerId', '==', uid), limit(500)));
      const myRewards = mineSnap.docs
        .filter(d => (d.data() as any)?.pairId === prevPairId)
        .map(d => d.id);
      await deleteInChunks(myRewards);

      // Best-effort: delete any remaining shared rewards for that pair
      try {
        const sharedSnap = await getDocs(query(col, where('pairId', '==', prevPairId)));
        const sharedIds = sharedSnap.docs.map(d => d.id);
        await deleteInChunks(sharedIds);
      } catch (e: any) {
        console.warn('[rewards cleanup] shared delete skipped:', e?.code ?? e?.message ?? e);
      }

      await AsyncStorage.setItem(marker, '1');
    } catch (e) {
      console.warn('[rewards cleanup] error', e);
    }
  }

  async function deleteInChunks(ids: string[], chunkSize = 300) {
    for (let i = 0; i < ids.length; i += chunkSize) {
      const slice = ids.slice(i, i + chunkSize);
      // Keep this best-effort delete tolerant of failures
      await Promise.all(
        slice.map(id =>
          deleteDoc(doc(db, 'rewards', id)).catch(() =>
            deleteDoc(doc(db, 'tasks', id)).catch(() => {})
          )
        )
      );
    }
  }

  // Rewards listener — only when paired; otherwise clear
  useEffect(() => {
    if (!user || !pairId) {
      setRewards([]);
      return;
    }
    const off = listenRewards(user.uid, pairId, setRewards);
    return () => off && off();
  }, [user, pairId]);

  // Shared-only listener with graceful index fallback
  useEffect(() => {
    if (!user || !pairId) {
      setTasks([]);
      return;
    }

    const baseCol = collection(db, 'tasks');
    const qWithOrder = query(baseCol, where('pairId', '==', pairId), orderBy('createdAt', 'desc'));

    let unsub: (() => void) | undefined;

    const startOrdered = () => {
      unsub = onSnapshot(
        qWithOrder,
        (snap) => {
          const next: TaskDoc[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<TaskDoc, 'id'>) }));
          setTasks(next);
        },
        (err) => {
          if ((err as any)?.code === 'failed-precondition') {
            const qNoOrder = query(baseCol, where('pairId', '==', pairId));
            unsub = onSnapshot(
              qNoOrder,
              (snap2) => {
                const next: TaskDoc[] = snap2.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<TaskDoc, 'id'>) }));
                next.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
                setTasks(next);
              },
              (e2) => console.warn('[firestore] fallback query error', e2)
            );
          } else {
            console.warn('[firestore] tasks listener error', err);
          }
        }
      );
    };

    startOrdered();
    return () => unsub && unsub();
  }, [user, pairId]);

  // Optional migration: attach recent no-pair tasks to current pair
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
      } catch {}
    })();
  }, [user, pairId]);

  // Streak doc
  useEffect(() => {
    if (!user) return;
    const ref = doc(db, 'streaks', user.uid);
    const off = listenDoc(ref, (snap) => setStreak(snap.exists() ? (snap.data() as any) : null), 'streaks');
    return () => off && off();
  }, [user]);

  // -------- Pair-aware LIVE total (union of pair points + my no-pair points) + optimistic bump
  const [totalLive, setTotalLive] = useState<number | null>(null);

  useEffect(() => {
    if (!user?.uid) {
      setTotalLive(null);
      return;
    }

    // maps of id -> value so we can union safely
    let ownerUnsub: (() => void) | undefined;
    let pairUnsub:  (() => void) | undefined;

    const ownerMap = new Map<string, number>();
    const pairMap  = new Map<string, number>();

    const recompute = () => {
      // union: all pair docs + owner docs that do NOT have a pairId
      let sum = 0;
      // pair docs (all)
      for (const v of pairMap.values()) sum += v;
      // owner docs (only those with no pairId)
      for (const [id, v] of ownerMap) {
        // ownerMap stores no-pair docs only (see listener)
        sum += v;
      }
      setTotalLive(sum);
    };

    // Listen to all my docs; keep only those with null/undefined pairId in ownerMap
    ownerUnsub = onSnapshot(
      query(collection(db, 'points'), where('ownerId', '==', user.uid)),
      (snap) => {
        ownerMap.clear();
        for (const d of snap.docs) {
          const data: any = d.data();
          const v = Number(data?.value ?? 0);
          const pid = data?.pairId ?? null;
          if ((pid === null || pid === undefined) && Number.isFinite(v)) {
            ownerMap.set(d.id, v);
          }
        }
        recompute();
      },
      () => {
        ownerMap.clear();
        recompute();
      }
    );

    // If paired, also listen to all docs for this pair
    if (pairId) {
      pairUnsub = onSnapshot(
        query(collection(db, 'points'), where('pairId', '==', pairId)),
        (snap) => {
          pairMap.clear();
          for (const d of snap.docs) {
            const v = Number((d.data() as any)?.value ?? 0);
            if (Number.isFinite(v)) pairMap.set(d.id, v);
          }
          recompute();
        },
        () => {
          pairMap.clear();
          recompute();
        }
      );
    } else {
      // if not paired, clear pair map
      pairMap.clear();
      recompute();
    }

    return () => {
      try { ownerUnsub && ownerUnsub(); } catch {}
      try { pairUnsub && pairUnsub(); } catch {}
    };
  }, [user?.uid, pairId]);

  // Optimistic bump on challenge completion
  const [totalOptimistic, setTotalOptimistic] = useState<{ bump: number; baseline: number } | null>(null);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('lp.challenge.completed', (payload: any) => {
      const pts = Number(payload?.points ?? 0);
      if (!pts) return;
      const baseline = (totalLive ?? total ?? 0);
      setTotalOptimistic({ bump: pts, baseline });
    });
    return () => sub.remove();
  }, [total, totalLive]);

  useEffect(() => {
    if (totalOptimistic) {
      const live = (totalLive ?? total ?? 0);
      const target = totalOptimistic.baseline + totalOptimistic.bump;
      if (live >= target) setTotalOptimistic(null);
    }
  }, [totalLive, total, totalOptimistic]);

  const totalBase = totalLive ?? (total ?? 0);
  const totalDisplay = totalOptimistic
    ? Math.max(totalBase, totalOptimistic.baseline + totalOptimistic.bump)
    : totalBase;

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
        pairId,
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

  const onRedeem = async (r: RewardDoc) => {
    if (!user) return;
    const current = totalDisplay; // union + optimistic
    if (current < r.cost) {
      const short = r.cost - current;
      Alert.alert(
        'Not enough points',
        `You need ${short} more point${short === 1 ? '' : 's'} to redeem “${r.title}”.`
      );
      return;
    }
    try {
      await redeemReward(user.uid, pairId ?? null, r);
    } catch (e: any) {
      Alert.alert('Could not redeem reward', e?.message ?? 'Please try again.');
    }
  };

  // NEW: delete reward (with undo). Honors security rules (only creator can delete if rules enforce it).
  async function handleDeleteReward(r: RewardDoc) {
    const backup = { ...r };
    try {
      await deleteDoc(doc(db, 'rewards', r.id));
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      showUndo('Reward deleted', async () => {
        // Re-create (new id) on undo
        await addDoc(collection(db, 'rewards'), {
          ownerId: backup.ownerId,
          pairId: backup.pairId ?? pairId ?? null,
          title: backup.title,
          cost: backup.cost,
          redeemed: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });
    } catch (e: any) {
      const msg =
        e?.code === 'permission-denied'
          ? 'Only the creator can delete this reward.'
          : e?.message ?? 'Please try again.';
      Alert.alert('Delete failed', msg);
    }
  }

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

  const rewardsSection = useMemo(() => {
    if (rewards.length === 0) return null;

    return (
      <Card style={{ marginBottom: 12, borderWidth: 1, borderColor: '#F0E6EF' }}>
        {/* Fold header */}
        <Pressable onPress={toggleRewardsOpen} accessibilityRole="button" style={s.foldHeader}>
          <ThemedText variant="subtitle" style={{ flex: 1 }}>
            Rewards {rewards.length ? `(${rewards.length})` : ''}
          </ThemedText>
          <Ionicons
            name="chevron-down"
            size={18}
            color={t.colors.textDim}
            style={[s.foldChevron, rewardsOpen && { transform: [{ rotate: '180deg' }] }]}
          />
        </Pressable>

        {rewardsOpen && (
          <>
            {rewards.map((item, i) => {
              const canRedeem = (totalDisplay) >= item.cost;
              return (
                <View key={item.id} style={[s.rewardRow, i > 0 && s.hairlineTop]}>
                  <View style={{ flex: 1 }}>
                    <ThemedText variant="title">{item.title}</ThemedText>
                    <ThemedText variant="caption" color={t.colors.textDim}>
                      Cost {item.cost} pts{!canRedeem ? ` • Need ${item.cost - (totalDisplay)}` : ''}
                    </ThemedText>
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Button label="Redeem" onPress={() => onRedeem(item)} disabled={!canRedeem} />
                    {/* Delete reward */}
                    <Pressable
                      onPress={() => handleDeleteReward(item)}
                      style={s.deleteBtn}
                      hitSlop={8}
                      accessibilityLabel="Delete reward"
                    >
                      <Ionicons name="trash-outline" size={20} color="#EF4444" />
                    </Pressable>
                  </View>
                </View>
              );
            })}
            {/* balance footer */}
            <View style={[s.hairlineTop, { paddingTop: 8 }]}>
              <ThemedText variant="caption" color={t.colors.textDim}>
                You have {totalDisplay} pt{totalDisplay === 1 ? '' : 's'} available.
              </ThemedText>
            </View>
          </>
        )}
      </Card>
    );
  }, [rewards, rewardsOpen, totalDisplay, t.colors.textDim]);

  const listHeader = (
    <View>
      <View style={s.headerRow}>
        <ThemedText variant="display" style={{ flexShrink: 1, marginRight: t.spacing.s }}>
          Shared tasks
        </ThemedText>
        <View style={{ flexShrink: 0 }}>
          <Button label="Add reward" variant="outline" onPress={() => setShowAddReward(true)} />
        </View>
      </View>

      {rewardsSection}

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

        <RedeemModal visible={showAddReward} onClose={() => setShowAddReward(false)} onCreate={onCreateReward} />

        <SpotlightAutoStarter uid={user?.uid ?? null} steps={TASKS_TOUR_STEPS} persistKey="tour-tasks-shared-only" />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

function toMillis(ts: any): number {
  if (!ts) return 0;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (ts.seconds != null) return ts.seconds * 1000 + (ts.nanoseconds || 0) / 1e6;
  try { return new Date(ts).getTime() || 0; } catch { return 0; }
}

function extractIndexUrl(msg: string): string | null {
  const m = msg.match(/https:\/\/console\.firebase\.google\.com\/[^\s)]+/);
  return m ? m[0] : null;
}

const styles = (t: ThemeTokens) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.colors.bg },

    headerRow: {
      paddingHorizontal: t.spacing.md,
      paddingTop: t.spacing.md,
      paddingBottom: t.spacing.s,
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      rowGap: 8,
      columnGap: 8,
    },

    header: { padding: t.spacing.md, paddingBottom: t.spacing.s },

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

    rewardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 },
    hairlineTop: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#F0E6EF', marginTop: 10, paddingTop: 10 },

    foldHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 6,
    },
    foldChevron: {
      marginLeft: 8,
    },
  });

export default TasksScreen;