// screens/TasksScreen.tsx
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActionSheetIOS,
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
import usePartnerUid from '../hooks/usePartnerUid';

import { createPointsEntry, deletePointsEntry } from '../utils/points';
import { listenDoc } from '../utils/snap';
import { activateCatchup, isoWeekStr, notifyTaskCompletion } from '../utils/streak';

import RedeemModal from '../components/RedeemModal';
import { listenRewards, type RewardDoc } from '../utils/rewards';

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
  kind?: 'shared' | 'personal';
  forUid?: string | null; // assignee (only for personal)
  worth?: number;         // points per award for this task
};

const FIRST_DONE_KEY = (uid: string) =>
  `lp:first-done:${uid}:${new Date().toISOString().slice(0, 10)}`;

function withAlpha(hex: string, alpha: number) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const a = Math.round(alpha * 255).toString(16).padStart(2, '0');
  return `#${full}${a}`;
}

function pickWorth(current: number): Promise<number> {
  return new Promise((resolve) => {
    const options = ['+1', '+2', '+3', '+5', '+10', 'Cancel'];
    const values = [1, 2, 3, 5, 10];

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          cancelButtonIndex: options.length - 1,
          title: 'How many points should this task be worth?',
        },
        (idx) => {
          if (idx === options.length - 1) return resolve(current);
          resolve(values[idx] ?? current);
        }
      );
    } else {
      Alert.alert('How many points should this task be worth?', undefined, [
        { text: '+1',  onPress: () => resolve(1)  },
        { text: '+2',  onPress: () => resolve(2)  },
        { text: '+3',  onPress: () => resolve(3)  },
        { text: '+5',  onPress: () => resolve(5)  },
        { text: '+10', onPress: () => resolve(10) },
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(current) },
      ]);
    }
  });
}

type TopTab = 'shared' | 'personal';
type PersonalTab = 'yours' | 'partners';
type RewardScope = 'shared' | 'personal';

const TasksScreen: React.FC = () => {
  /* ──────────────────────────────────────────────────────────── */
  /* Small helper to notify partner after redeem                  */
  /* Writes to /notifications and emits a local event.            */
  /* If you already have a CF listening on /notifications,        */
  /* this will produce a push. Otherwise it's a safe no-op.       */
  /* ──────────────────────────────────────────────────────────── */
  async function notifyRewardRedeemedLocal(
    actorUid: string,
    pairIdValue: string | null,
    rewardTitle: string,
    scope: RewardScope
  ) {
    try {
      await addDoc(collection(db, 'notifications'), {
        type: 'reward_redeemed',
        pairId: pairIdValue ?? null,
        actorUid,
        title: rewardTitle,
        scope,
        createdAt: serverTimestamp(),
      });
    } catch {}
    try {
      DeviceEventEmitter.emit('lp.reward.redeemed', { pairId: pairIdValue, title: rewardTitle, scope });
    } catch {}
  }
  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const { user } = useAuthListener();
  const t = useTokens();
  const s = useMemo(() => styles(t), [t]);

  const [pairId, setPairId] = useState<string | null>(null);
  const [topTab, setTopTab] = useState<TopTab>('shared');
  const [personalTab, setPersonalTab] = useState<PersonalTab>('yours');

  const partnerUid = usePartnerUid(user?.uid ?? null);

  const prevPairRef = useRef<string | null>(null);
  const [tasks, setTasks] = useState<TaskDoc[]>([]);
  const [rewards, setRewards] = useState<RewardDoc[]>([]);

  // Rewards scope/balances (zeigt die Liste an; fürs Erstellen wird die Auswahl im Modal benutzt)
  const [rewardScope, setRewardScope] = useState<RewardScope>('shared');
  const [personalRedeemable, setPersonalRedeemable] = useState(0);
  const [spentPersonalSum, setSpentPersonalSum] = useState(0);
  const [spentSharedSum, setSpentSharedSum] = useState(0);

  // Shared input
  const [title, setTitle] = useState('');
  // Personal input (nur im "partners"-Subtab)
  const [titlePersonal, setTitlePersonal] = useState('');
  // Point value pickers next to inputs
  const [sharedWorth, setSharedWorth] = useState<number>(1);
  const [personalWorth, setPersonalWorth] = useState<number>(1);

  const [titleError, setTitleError] = useState<string | undefined>(undefined);
  const inputRef = useRef<any>(null);
  const inputPersonalRef = useRef<any>(null);

  const [toast, setToast] = useState<{ visible: boolean; msg: string; undo?: () => Promise<void> | void; }>({ visible: false, msg: '' });
  const showUndo = (message: string, undo?: () => Promise<void> | void) => setToast({ visible: true, msg: message, undo });

  const [showConfetti, setShowConfetti] = useState(false);
  const [showAddReward, setShowAddReward] = useState(false);

  // Persisted fold state für Rewards
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

  // Accept preset idea (shared flow unchanged)
  useEffect(() => {
    const preset: string | undefined = route.params?.presetIdea;
    if (preset) {
      setTopTab('shared');
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

      const mineSnap = await getDocs(query(col, where('ownerId', '==', uid), limit(500)));
      const mineToDelete = mineSnap.docs
        .filter(d => (d.data() as any)?.pairId === prevPairId)
        .map(d => d.id);
      await deleteInChunks(mineToDelete);

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

  async function cleanupRewardsForPreviousPair(prevPairId: string, uid: string) {
    try {
      const marker = `lp:rewards-cleaned:${prevPairId}:${uid}`;
      const done = await AsyncStorage.getItem(marker);
      if (done) return;

      const col = collection(db, 'rewards');

      const mineSnap = await getDocs(query(col, where('ownerId', '==', uid), limit(500)));
      const myRewards = mineSnap.docs
        .filter(d => (d.data() as any)?.pairId === prevPairId)
        .map(d => d.id);
      await deleteInChunks(myRewards);

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

  // Sum ALL shared redemptions for this pair (both users) from append-only collection
  useEffect(() => {
    if (!pairId) {
      setSpentSharedSum(0);
      return;
    }
    const qRef = query(
      collection(db, 'rewardRedemptions'),
      where('pairId', '==', pairId),
      where('scope', '==', 'shared')
    );
    const unsub = onSnapshot(
      qRef,
      (snap) => {
        let sum = 0;
        for (const d of snap.docs) {
          const data: any = d.data();
          const v = Number(data?.cost ?? 0);
          if (Number.isFinite(v) && v > 0) sum += v;
        }
        setSpentSharedSum(sum);
      },
      () => setSpentSharedSum(0)
    );
    return () => unsub && unsub();
  }, [pairId]);

  // Sum PERSONAL redemptions for this user from append-only collection
  useEffect(() => {
    if (!pairId || !user?.uid) {
      setSpentPersonalSum(0);
      return;
    }

    const qRef = query(
      collection(db, 'rewardRedemptions'),
      where('pairId', '==', pairId),
      where('scope', '==', 'personal'),
      where('redeemedBy', '==', user.uid)
    );

    const unsub = onSnapshot(
      qRef,
      (snap) => {
        let sum = 0;
        for (const d of snap.docs) {
          const data: any = d.data();
          const v = Number(data?.cost ?? 0);
          if (Number.isFinite(v) && v > 0) sum += v;
        }
        setSpentPersonalSum(sum);
      },
      () => setSpentPersonalSum(0)
    );

    return () => unsub && unsub();
  }, [pairId, user?.uid]);

  // Single listener for all pair tasks (shared + personal); we filter in-memory
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

  // -------- LIVE totals ----------------------------------------------------
  // 1) pairTotalLive: sum of positive /points where pairId == current pair (identical for both partners)
  // 2) ownerSoloLive: sum of positive /points owned by me with no pairId (used only for *personal* balance on this screen)
  // 3) totalOptimistic: animation bump; we apply it to both streams if needed

  const [pairTotalLive, setPairTotalLive] = useState<number | null>(null);
  const [ownerSoloLive, setOwnerSoloLive] = useState<number>(0);
  const [totalOptimistic, setTotalOptimistic] = useState<{ bump: number; baselinePair: number; baselineOwner: number } | null>(null);

  useEffect(() => {
    if (!user?.uid) {
      setPairTotalLive(null);
      setOwnerSoloLive(0);
      return;
    }

    let soloUnsub: (() => void) | undefined;
    let minePairOuterUnsub: (() => void) | undefined;
    let partnerPairOuterUnsub: (() => void) | undefined;

    // (A) owner-only points (no pairId) — unchanged
    soloUnsub = onSnapshot(
      query(collection(db, 'points'), where('ownerId', '==', user.uid)),
      (snap) => {
        let sum = 0;
        for (const d of snap.docs) {
          const data: any = d.data();
          const v = Number(data?.value ?? 0);
          const pid = data?.pairId ?? null;
          if ((pid === null || pid === undefined) && Number.isFinite(v) && v > 0) sum += v;
        }
        setOwnerSoloLive(sum);
      },
      () => setOwnerSoloLive(0)
    );

    // (B) shared points for the current pair (sum mine + partner, exclude personal)
    if (pairId) {
      const base = collection(db, 'points');

      let mineShared = 0;
      let partnerShared = 0;

      const recompute = () => setPairTotalLive(mineShared + partnerShared);

      const isPersonalEntry = (data: any) => {
        const reason = String(data?.reason ?? '').toLowerCase();
        return (
          data?.scope === 'personal' ||
          data?.kind === 'personal' ||
          reason.includes('personal task')
        );
      };

      const computeSharedForPair = (snap: any, alreadyFilteredByPair: boolean) => {
        let sum = 0;
        for (const d of snap.docs) {
          const data: any = d.data();
          const v = Number(data?.value ?? 0);
          if (!Number.isFinite(v) || v <= 0) continue;
          if (!alreadyFilteredByPair && data?.pairId !== pairId) continue;
          if (isPersonalEntry(data)) continue;
          sum += v;
        }
        return sum;
      };

      // Prefer ownerId+pairId; on index/permission error, fallback to ownerId-only and filter locally by pairId
      const listenOwnerShared = (ownerIdToListen: string, setVal: (n: number) => void) => {
        let innerUnsub: (() => void) | undefined;

        const startPrimary = () => {
          innerUnsub = onSnapshot(
            query(base, where('ownerId', '==', ownerIdToListen), where('pairId', '==', pairId)),
            (snap) => setVal(computeSharedForPair(snap, /*alreadyFilteredByPair*/ true)),
            (err) => {
              const code = (err as any)?.code;
              if (code === 'failed-precondition' || code === 'permission-denied') {
                // Fallback: owner-only stream, filter in-memory
                innerUnsub = onSnapshot(
                  query(base, where('ownerId', '==', ownerIdToListen)),
                  (snap2) => setVal(computeSharedForPair(snap2, /*alreadyFilteredByPair*/ false)),
                  () => setVal(0)
                );
              } else {
                console.warn('[points] owner+pair query error', err);
                setVal(0);
              }
            }
          );
        };

        startPrimary();
        return () => {
          try { innerUnsub && innerUnsub(); } catch {}
        };
      };

      // Mine (always readable)
      minePairOuterUnsub = listenOwnerShared(user.uid, (val) => {
        mineShared = val; recompute();
      });

      // Partner (may be blocked by rules; fallback will set 0 if so)
      if (partnerUid) {
        partnerPairOuterUnsub = listenOwnerShared(partnerUid, (val) => {
          partnerShared = val; recompute();
        });
      } else {
        partnerShared = 0;
        recompute();
      }
    } else {
      setPairTotalLive(0);
    }

    return () => {
      try { soloUnsub && soloUnsub(); } catch {}
      try { minePairOuterUnsub && minePairOuterUnsub(); } catch {}
      try { partnerPairOuterUnsub && partnerPairOuterUnsub(); } catch {}
    };
  }, [user?.uid, partnerUid, pairId]);

  // Challenge completion animation bump
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('lp.challenge.completed', (payload: any) => {
      const pts = Number(payload?.points ?? 0);
      if (!pts) return;
      setTotalOptimistic({
        bump: pts,
        baselinePair: pairTotalLive ?? 0,
        baselineOwner: ownerSoloLive ?? 0,
      });
    });
    return () => sub.remove();
  }, [pairTotalLive, ownerSoloLive]);

  useEffect(() => {
    if (totalOptimistic) {
      const reachedPair  = (pairTotalLive  ?? 0) >= (totalOptimistic.baselinePair  + totalOptimistic.bump);
      const reachedOwner = (ownerSoloLive ?? 0) >= (totalOptimistic.baselineOwner + totalOptimistic.bump);
      if (reachedPair && reachedOwner) setTotalOptimistic(null);
    }
  }, [pairTotalLive, ownerSoloLive, totalOptimistic]);

  const pairTotalDisplay = totalOptimistic
    ? Math.max(pairTotalLive ?? 0,  (totalOptimistic.baselinePair  + totalOptimistic.bump))
    : (pairTotalLive ?? 0);

  const ownerSoloDisplay = totalOptimistic
    ? Math.max(ownerSoloLive ?? 0, (totalOptimistic.baselineOwner + totalOptimistic.bump))
    : (ownerSoloLive ?? 0);

  // Personal-only redeemable balance (sum of my positive personal points for this pair)
  useEffect(() => {
    if (!user?.uid || !pairId) {
      setPersonalRedeemable(0);
      return;
    }

    // Query only by ownerId; filter rest locally (avoids composite index)
    const qRef = query(
      collection(db, 'points'),
      where('ownerId', '==', user.uid)
    );

    const unsub = onSnapshot(
      qRef,
      (snap) => {
        let sum = 0;
        for (const d of snap.docs) {
          const data: any = d.data();

          // must belong to current pair
          if (data?.pairId !== pairId) continue;

          const v = Number(data?.value ?? 0);
          if (!Number.isFinite(v) || v <= 0) continue;

          const reason = (String(data?.reason ?? '')).toLowerCase();
          const isPersonal =
            data?.scope === 'personal' ||
            data?.kind === 'personal' ||
            reason.includes('personal task');

          if (isPersonal) sum += v;
        }
        setPersonalRedeemable(sum);
      },
      () => setPersonalRedeemable(0)
    );

    return () => unsub && unsub();
  }, [user?.uid, pairId]);

  // ---- Rewards: Tasks-only "available" Balance
  // Global (Home/Challenges) bleibt unverändert. Hier ziehen wir NUR bereits eingelöste Rewards (redeemed)
  // vom jeweiligen Scope ab, um die lokal verfügbare Summe fürs Einlösen zu zeigen.
  const spentShared = useMemo(() => {
    return rewards.reduce((sum, r: any) => {
      const scopeRaw = r?.scope ?? 'shared';
      const scope = typeof scopeRaw === 'string' ? scopeRaw.toLowerCase() : 'shared';
      if (scope === 'personal') return sum;
      if (r?.redeemed) return sum + (Number(r?.cost) || 0);
      return sum;
    }, 0);
  }, [rewards]);

  const spentPersonal = useMemo(() => {
    return rewards.reduce((sum, r: any) => {
      const scopeRaw = r?.scope ?? 'shared';
      const scope = typeof scopeRaw === 'string' ? scopeRaw.toLowerCase() : 'shared';
      if (scope !== 'personal') return sum;
      const redeemedBy = (r as any)?.redeemedBy;
      if (r?.redeemed && redeemedBy && user?.uid && redeemedBy === user.uid) {
        return sum + (Number(r?.cost) || 0);
      }
      return sum;
    }, 0);
  }, [rewards, user?.uid]);

  const effectiveSpentShared = spentSharedSum || spentShared;
  const effectiveSpentPersonal = spentPersonalSum || spentPersonal;

  // Fallback: shared points earned via tasks (sum of task.points on shared tasks)
  const sharedEarnedFromTasks = useMemo(() => {
    return tasks.reduce((sum, t) => {
      const isShared = (t.kind ?? 'shared') !== 'personal';
      if (!isShared) return sum;
      return sum + (Number(t.points) || 0);
    }, 0);
  }, [tasks]);

  // Prefer live pair points; fall back to aggregated task points if needed (take the max)
  const sharedGrossForRewards = Math.max((pairTotalDisplay ?? 0), sharedEarnedFromTasks);
  const sharedAvailableForRewards = Math.max(0, sharedGrossForRewards - effectiveSpentShared);
  const personalAvailableForRewards = Math.max(0, (personalRedeemable ?? 0) - effectiveSpentPersonal);

  /* ──────────────────────────────────────────────────────────── */
  /* SHARED: unchanged behavior                                   */
  /* ──────────────────────────────────────────────────────────── */

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
        worth: sharedWorth,
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

  async function handleToggleDoneShared(item: TaskDoc) {
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

  async function awardPointsShared(item: TaskDoc, amount: number) {
    if (!user) return;
    try {
      const pointsId = await createPointsEntry({
        ownerId: user.uid,               // shared points count for both
        pairId: item.pairId ?? null,
        value: amount,                   // variable amount
        reason: `Task: ${item.title}`,
        taskId: item.id,
        scope: 'shared',
        kind: 'shared',
      });

      await updateDoc(doc(db, 'tasks', item.id), {
        points: (item.points ?? 0) + amount,
        updatedAt: serverTimestamp(),
      });

      showUndo(`+${amount} point${amount === 1 ? '' : 's'} added 🎉`, async () => {
        await deletePointsEntry(pointsId);
        await updateDoc(doc(db, 'tasks', item.id), {
          points: Math.max(0, (item.points ?? 0)),
          updatedAt: serverTimestamp(),
        });
      });
    } catch (e: any) {
      Alert.alert('Could not award points', e?.message ?? 'Please try again.');
    }
  }

  async function handleAwardPointShared(item: TaskDoc) {
    const amount = Math.max(1, Number(item.worth) || 1);
    await awardPointsShared(item, amount);
  }

  /* ──────────────────────────────────────────────────────────── */
  /* PERSONAL                                                     */
  /* ──────────────────────────────────────────────────────────── */

  async function handleAddPersonalTask() {
    if (!user) return;
    const trimmed = titlePersonal.trim();
    if (!trimmed) return;
    if (!pairId || !partnerUid) {
      Alert.alert('Link accounts first', 'Open Pairing to link with your partner before adding personal tasks.');
      return;
    }
    try {
      const payload: Omit<TaskDoc, 'id'> = {
        title: trimmed,
        ownerId: user.uid,          // creator
        forUid: partnerUid,         // assignee is partner
        pairId,
        kind: 'personal',
        done: false,
        points: 0,
        worth: personalWorth,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      await addDoc(collection(db, 'tasks'), payload);
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setTitlePersonal('');
      Keyboard.dismiss();
      showUndo('Added to partner’s list.');
    } catch (e: any) {
      Alert.alert('Couldn’t add task', e?.message ?? 'Please try again.');
    }
  }

  async function handleToggleDonePersonal(item: TaskDoc) {
    if (!user) return;
    if (item.forUid && item.forUid !== user.uid) {
      Alert.alert('Only assignee can complete', 'Your partner can mark this one as done.');
      return;
    }
    try {
      const nextDone = !item.done;
      await updateDoc(doc(db, 'tasks', item.id), { done: nextDone, updatedAt: serverTimestamp() });
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      if (nextDone) {
        maybeShowConfettiOnFirstDone();
      }
      showUndo(nextDone ? 'Marked complete' : 'Marked incomplete', async () => {
        await updateDoc(doc(db, 'tasks', item.id), { done: item.done ?? false, updatedAt: serverTimestamp() });
      });
    } catch (e: any) {
      Alert.alert('Update failed', e?.message ?? 'Please try again.');
    }
  }

  async function awardPointsPersonal(item: TaskDoc, amount: number) {
    if (!user || !pairId) return;
    const recipientUid = item.forUid; // award only to partner (assignee)
    if (!recipientUid || recipientUid === user.uid) return;

    try {
      const pointsId = await createPointsEntry({
        ownerId: recipientUid, // credit to partner (assignee)
        pairId,
        value: amount,         // variable amount
        reason: `Personal task: ${item.title}`,
        taskId: item.id,
        // mark unmistakably as personal so balances pick it up
        scope: 'personal',
        kind: 'personal',
        forUid: recipientUid,
      });

      await updateDoc(doc(db, 'tasks', item.id), {
        points: (item.points ?? 0) + amount,
        updatedAt: serverTimestamp(),
      });

      showUndo(`+${amount} point${amount === 1 ? '' : 's'} added for your partner 🎉`, async () => {
        await deletePointsEntry(pointsId);
        await updateDoc(doc(db, 'tasks', item.id), {
          points: Math.max(0, (item.points ?? 0)),
          updatedAt: serverTimestamp(),
        });
      });
    } catch (e: any) {
      Alert.alert('Could not award points', e?.message ?? 'Please try again.');
    }
  }

  async function handleAwardPointPersonal(item: TaskDoc) {
    const amount = Math.max(1, Number(item.worth) || 1);
    await awardPointsPersonal(item, amount);
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
          kind: backup.kind ?? undefined,
          forUid: backup.forUid ?? null,
          done: backup.done ?? false,
          points: backup.points ?? 0,
          worth: backup.worth ?? 1,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });
    } catch (e: any) {
      Alert.alert('Delete failed', e?.message ?? 'Please try again.');
    }
  }

  // Neuer Creator: akzeptiert optional Scope (aus dem Modal)
  const onCreateReward = async (title: string, cost: number, scopeOverride?: RewardScope) => {
    if (!user) return;
    try {
      const scopeToUse: RewardScope = scopeOverride ?? rewardScope;
      await addDoc(collection(db, 'rewards'), {
        ownerId: user.uid,
        pairId: pairId ?? null,
        title,
        cost,
        scope: scopeToUse,
        redeemed: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      // optional: nach dem Erstellen auf die gerade genutzte Ansicht wechseln
      if (scopeOverride && scopeOverride !== rewardScope) {
        setRewardScope(scopeOverride);
      }
    } catch (e: any) {
      Alert.alert('Could not add reward', e?.message ?? 'Please try again.');
    }
  };

  const onRedeem = async (r: RewardDoc) => {
    if (!user) return;

    const scope = ((r as any)?.scope ?? 'shared') as RewardScope;
    const balance = scope === 'personal' ? personalAvailableForRewards : sharedAvailableForRewards;

    if (balance < r.cost) {
      const short = r.cost - balance;
      Alert.alert(
        'Not enough points',
        `You need ${short} more point${short === 1 ? '' : 's'} to redeem “${r.title}” in ${scope} rewards.`
      );
      return;
    }

    try {
      // Append-only redemption record – do NOT toggle fields on the reward document
      const redemptionRef = await addDoc(collection(db, 'rewardRedemptions'), {
        rewardId: r.id,
        title: r.title,
        cost: r.cost,
        scope,
        pairId: pairId ?? null,
        redeemedBy: user.uid,
        createdAt: serverTimestamp(),
      });

      // Push/local notify
      await notifyRewardRedeemedLocal(user.uid, pairId ?? null, r.title, scope);

      // Undo by deleting the redemption record
      showUndo(`Redeemed “${r.title}” 🎉`, async () => {
        try {
          await deleteDoc(doc(db, 'rewardRedemptions', redemptionRef.id));
        } catch {}
      });
    } catch (e: any) {
      Alert.alert('Could not redeem reward', e?.message ?? 'Please try again.');
    }
  };

  async function handleDeleteReward(r: RewardDoc) {
    const backup = { ...r };
    try {
      await deleteDoc(doc(db, 'rewards', r.id));
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      showUndo('Reward deleted', async () => {
        await addDoc(collection(db, 'rewards'), {
          ownerId: (backup as any).ownerId,
          pairId: (backup as any).pairId ?? pairId ?? null,
          title: (backup as any).title,
          cost: (backup as any).cost,
          scope: (backup as any)?.scope ?? 'shared',
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

  /* ──────────────────────────────────────────────────────────── */
  /* Derived task buckets                                         */
  /* ──────────────────────────────────────────────────────────── */

  const sharedTasks = useMemo(
    () => tasks.filter(t => (t.kind ?? 'shared') !== 'personal'),
    [tasks]
  );

  const personalYour = useMemo(
    () => tasks.filter(t => t.kind === 'personal' && !!user?.uid && t.forUid === user.uid),
    [tasks, user?.uid]
  );

  const personalPartners = useMemo(
    () => tasks.filter(t => t.kind === 'personal' && !!partnerUid && t.forUid === partnerUid),
    [tasks, partnerUid]
  );

  /* ──────────────────────────────────────────────────────────── */
  /* Rendering                                                    */
  /* ──────────────────────────────────────────────────────────── */

  const TASKS_TOUR_STEPS: SpotlightStep[] = useMemo(() => {
    if (topTab !== 'shared') return [];
    const arr: SpotlightStep[] = [
      { id: 'tsk-welcome', targetId: null, title: 'Shared Tasks', text: 'Both partners see and update this list.', placement: 'bottom', allowBackdropTapToNext: true },
      { id: 'tsk-input', targetId: 'ts-input', title: 'Add a task', text: 'Type a small, kind action.' },
      { id: 'tsk-add', targetId: 'ts-add', title: 'Save it', text: 'Tap Add to put it on the list.', placement: 'top' },
      { id: 'tsk-suggestions', targetId: 'ts-suggestions', title: 'Ideas', text: 'Tap a suggestion to prefill.' },
    ];
    if (sharedTasks.length > 0) {
      arr.push(
        { id: 'tsk-done',   targetId: 'ts-done',   title: 'Mark complete', text: 'Tap the box when you’re done.' },
        { id: 'tsk-award',  targetId: 'ts-award',  title: 'Give a point',  text: 'Reward effort with +1.', placement: 'top' },
        { id: 'tsk-delete', targetId: 'ts-delete', title: 'Delete',        text: 'Remove things you don’t need.', placement: 'top' },
      );
    }
    return arr;
  }, [topTab, sharedTasks.length]);

  const renderItemShared = ({ item, index }: { item: TaskDoc; index: number }) => {
    const done = !!item.done;
    const isFirst = index === 0;

    const Checkbox = (
      <View style={[s.checkbox, done && { backgroundColor: t.colors.primary, borderColor: t.colors.primary }]}>
        {done ? <Ionicons name="checkmark" size={16} color="#fff" /> : null}
      </View>
    );
    const AwardBtn = (
      <Pressable onPress={() => handleAwardPointShared(item)} style={s.awardBtn} hitSlop={8} accessibilityLabel="Add point">
        <Ionicons name="add-circle" size={20} color={t.colors.primary} />
      </Pressable>
    );
    const DeleteBtn = (
      <Pressable onPress={() => handleDelete(item)} style={s.deleteBtn} hitSlop={8} accessibilityLabel="Delete task">
        <Ionicons name="trash-outline" size={20} color="#EF4444" />
      </Pressable>
    );

    const worthDisplay = Math.max(1, Number(item.worth) || 1);

    return (
      <Card style={s.itemCard}>
        <Pressable onPress={() => handleToggleDoneShared(item)} style={s.itemRow} accessibilityRole="button">
          {isFirst ? <SpotlightTarget id="ts-done">{Checkbox}</SpotlightTarget> : Checkbox}

          <View style={{ flex: 1 }}>
            <ThemedText variant="title" color={done ? t.colors.textDim : t.colors.text}>
              {item.title}
            </ThemedText>
            <View style={s.metaRow}>
              <View style={s.pointsPill}>
                <ThemedText variant="caption" color={t.colors.primary}>
                  +{worthDisplay} pt{worthDisplay === 1 ? '' : 's'}
                </ThemedText>
              </View>
            </View>
          </View>

          {isFirst ? <SpotlightTarget id="ts-award">{AwardBtn}</SpotlightTarget> : AwardBtn}
          {isFirst ? <SpotlightTarget id="ts-delete">{DeleteBtn}</SpotlightTarget> : DeleteBtn}
        </Pressable>
      </Card>
    );
  };

  const renderItemPersonal = ({ item }: { item: TaskDoc; index: number }) => {
    const done = !!item.done;
    const viewingPartnersList = personalTab === 'partners';
    const canToggle = item.forUid === user?.uid;
    const showAward = viewingPartnersList;
    const canDelete = item.ownerId === user?.uid;

    const Checkbox = (
      <View style={[s.checkbox, done && { backgroundColor: t.colors.primary, borderColor: t.colors.primary, opacity: canToggle ? 1 : 0.5 }]}>
        {done ? <Ionicons name="checkmark" size={16} color="#fff" /> : null}
      </View>
    );
    const AwardBtn = showAward ? (
      <Pressable onPress={() => handleAwardPointPersonal(item)} style={s.awardBtn} hitSlop={8} accessibilityLabel="Add point for partner">
        <Ionicons name="add-circle" size={20} color={t.colors.primary} />
      </Pressable>
    ) : null;
    const DeleteBtn = canDelete ? (
      <Pressable onPress={() => handleDelete(item)} style={s.deleteBtn} hitSlop={8} accessibilityLabel="Delete task">
        <Ionicons name="trash-outline" size={20} color="#EF4444" />
      </Pressable>
    ) : null;

    const worthDisplay = Math.max(1, Number(item.worth) || 1);

    return (
      <Card style={s.itemCard}>
        <Pressable
          onPress={() => (canToggle ? handleToggleDonePersonal(item) : Alert.alert('Only assignee can complete', 'Your partner can mark this one as done.'))}
          style={s.itemRow}
          accessibilityRole="button"
        >
          {Checkbox}

          <View style={{ flex: 1 }}>
            <ThemedText variant="title" color={done ? t.colors.textDim : t.colors.text}>
              {item.title}
            </ThemedText>
            <View style={s.metaRow}>
              <View style={s.pointsPill}>
                <ThemedText variant="caption" color={t.colors.primary}>
                  +{worthDisplay} pt{worthDisplay === 1 ? '' : 's'}
                </ThemedText>
              </View>
            </View>
          </View>

          {AwardBtn}
          {DeleteBtn}
        </Pressable>
      </Card>
    );
  };

  const rewardsSection = useMemo(() => {
    if (rewards.length === 0) return null;

    const balance = rewardScope === 'shared' ? sharedAvailableForRewards : personalAvailableForRewards;

    // Nur Rewards des aktuell gewählten Scopes anzeigen
    const filteredRewards = rewards.filter((r: any) => {
      const scope = r?.scope ?? 'shared'; // legacy -> shared
      return rewardScope === 'shared' ? scope !== 'personal' : scope === 'personal';
    });

    return (
      <Card style={{ marginBottom: 12, borderWidth: 1, borderColor: '#F0E6EF' }}>
        {/* Fold header */}
        <Pressable onPress={toggleRewardsOpen} accessibilityRole="button" style={s.foldHeader}>
          <ThemedText variant="subtitle" style={{ flex: 1 }}>
            Rewards {filteredRewards.length ? `(${filteredRewards.length})` : ''}
          </ThemedText>
          <Ionicons
            name="chevron-down"
            size={18}
            color={t.colors.textDim}
            style={[s.foldChevron, rewardsOpen && { transform: [{ rotate: '180deg' }] }]}
          />
        </Pressable>

        {/* Scope Toggle für die Anzeige */}
        {rewardsOpen && (
          <View style={s.rewardsTabs}>
            <Pressable
              onPress={() => setRewardScope('shared')}
              style={[s.subTab, rewardScope === 'shared' && s.subTabActive]}
            >
              <ThemedText variant="label" color={rewardScope === 'shared' ? '#fff' : t.colors.text}>
                Shared
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={() => setRewardScope('personal')}
              style={[s.subTab, rewardScope === 'personal' && s.subTabActive]}
            >
              <ThemedText variant="label" color={rewardScope === 'personal' ? '#fff' : t.colors.text}>
                Personal
              </ThemedText>
            </Pressable>
          </View>
        )}

        {rewardsOpen && (
          <>
            {filteredRewards.map((item, i) => {
              const canRedeem = balance >= item.cost;
              return (
                <View key={item.id} style={[s.rewardRow, i > 0 && s.hairlineTop]}>
                  <View style={{ flex: 1 }}>
                    <ThemedText variant="title">{item.title}</ThemedText>
                    <ThemedText variant="caption" color={t.colors.textDim}>
                      Cost {item.cost} pts{!canRedeem ? ` • Need ${item.cost - balance}` : ''}
                    </ThemedText>
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Button label="Redeem" onPress={() => onRedeem(item)} disabled={!canRedeem} />
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
            <View style={[s.hairlineTop, { paddingTop: 8 }]}>
              <ThemedText variant="caption" color={t.colors.textDim}>
                You have {balance} pt{balance === 1 ? '' : 's'} available ({rewardScope}).
              </ThemedText>
            </View>
          </>
        )}
      </Card>
    );
  }, [rewards, rewardsOpen, t.colors.textDim, sharedAvailableForRewards, personalAvailableForRewards, rewardScope]);

  const showCatchupChip = useMemo(() => {
    if (!streak) return true;
    const thisWeek = isoWeekStr(new Date());
    const alreadyUsedThisWeek  = (streak as any)?.catchupWeekISO === thisWeek;
    const alreadyArmedThisWeek = (streak as any)?.catchupIntentWeekISO === thisWeek;
    const pending = !!(streak as any)?.catchupPending;
    return !alreadyUsedThisWeek && !alreadyArmedThisWeek && !pending;
  }, [streak]);

  const headerShared = (
    <View>
      {/* Top Tabs */}
      <View style={s.topTabs}>
        <Pressable onPress={() => setTopTab('shared')} style={[s.tab, topTab === 'shared' && s.tabActive]}>
          <ThemedText variant="label" color={topTab === 'shared' ? '#fff' : t.colors.text}>Shared</ThemedText>
        </Pressable>
        <Pressable onPress={() => setTopTab('personal')} style={[s.tab, topTab === 'personal' && s.tabActive]}>
          <ThemedText variant="label" color={topTab === 'personal' ? '#fff' : t.colors.text}>Personal</ThemedText>
        </Pressable>
      </View>

      {/* Header mit großem Add-Button */}
      <View style={s.headerRowNoWrap}>
        <ThemedText variant="display" style={{ flexShrink: 1, marginRight: t.spacing.s }}>
          Shared tasks
        </ThemedText>
        <Button label="Add reward" onPress={() => setShowAddReward(true)} />
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
          <Pressable
            onPress={async () => setSharedWorth(await pickWorth(sharedWorth))}
            style={s.pointsPicker}
            accessibilityRole="button"
            accessibilityLabel="Set task point value"
            hitSlop={8}
          >
            <Ionicons name="trophy-outline" size={14} color={t.colors.primary} />
            <ThemedText variant="label" style={s.pointsPickerText}>
              +{sharedWorth}
            </ThemedText>
          </Pressable>
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

  const headerPersonal = (
    <View>
      {/* Top Tabs */}
      <View style={s.topTabs}>
        <Pressable onPress={() => setTopTab('shared')} style={[s.tab, topTab === 'shared' && s.tabActive]}>
          <ThemedText variant="label" color={topTab === 'shared' ? '#fff' : t.colors.text}>Shared</ThemedText>
        </Pressable>
        <Pressable onPress={() => setTopTab('personal')} style={[s.tab, topTab === 'personal' && s.tabActive]}>
          <ThemedText variant="label" color={topTab === 'personal' ? '#fff' : t.colors.text}>Personal</ThemedText>
        </Pressable>
      </View>

      <View style={s.headerRow}>
        <ThemedText variant="display" style={{ flexShrink: 1 }}>
          Personal tasks
        </ThemedText>
      </View>

      {/* Sub tabs */}
      <View style={s.subTabs}>
        <Pressable onPress={() => setPersonalTab('yours')} style={[s.subTab, personalTab === 'yours' && s.subTabActive]}>
          <ThemedText variant="label" color={personalTab === 'yours' ? '#fff' : t.colors.text}>Your tasks</ThemedText>
        </Pressable>
        <Pressable onPress={() => setPersonalTab('partners')} style={[s.subTab, personalTab === 'partners' && s.subTabActive]}>
          <ThemedText variant="label" color={personalTab === 'partners' ? '#fff' : t.colors.text}>Partner’s tasks</ThemedText>
        </Pressable>
      </View>

      {/* Input nur im Partners-Tab */}
      {personalTab === 'partners' && (
        <Card style={{ marginBottom: t.spacing.md }}>
          <View style={s.inputRow}>
            <Input
              ref={inputPersonalRef}
              value={titlePersonal}
              onChangeText={setTitlePersonal}
              placeholder={pairId ? 'New task for your partner…' : 'Link accounts to add personal tasks'}
              containerStyle={{ flex: 1, marginRight: t.spacing.s }}
              editable={!!pairId && !!partnerUid}
              returnKeyType="done"
              onSubmitEditing={handleAddPersonalTask}
            />
            <Pressable
              onPress={async () => setPersonalWorth(await pickWorth(personalWorth))}
              style={s.pointsPicker}
              accessibilityRole="button"
              accessibilityLabel="Set task point value"
              hitSlop={8}
            >
              <Ionicons name="trophy-outline" size={14} color={t.colors.primary} />
              <ThemedText variant="label" style={s.pointsPickerText}>
                +{personalWorth}
              </ThemedText>
            </Pressable>
            <Button label="Add" onPress={handleAddPersonalTask} disabled={!titlePersonal.trim() || !pairId || !partnerUid} />
          </View>
          <ThemedText variant="caption" color={t.colors.textDim} style={{ marginTop: t.spacing.s }}>
            Create tasks your partner should do. You can give them points here.
          </ThemedText>
        </Card>
      )}
    </View>
  );

  /* Which dataset + renderers to use based on tabs */
  const data = topTab === 'shared'
    ? sharedTasks
    : (personalTab === 'yours' ? personalYour : personalPartners);

  const renderItem = topTab === 'shared' ? renderItemShared : renderItemPersonal;

  const emptyBlock = topTab === 'shared'
    ? (
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
    )
    : (
      <Card>
        <View style={{ alignItems: 'center', paddingVertical: t.spacing.lg }}>
          <ThemedText variant="display">👥</ThemedText>
          <ThemedText variant="title" style={{ marginTop: t.spacing.xs }}>
            {personalTab === 'yours' ? 'No tasks from your partner yet' : 'No tasks for your partner yet'}
          </ThemedText>
          <ThemedText variant="caption" color={t.colors.textDim} style={{ marginTop: t.spacing.xs }}>
            {personalTab === 'yours'
              ? 'Ask your partner to add something for you ✨'
              : 'Create a small, kind task for them 💞'}
          </ThemedText>
          {personalTab === 'partners' && (
            <View style={{ marginTop: t.spacing.md }}>
              <Button label="Add a task" onPress={() => inputPersonalRef.current?.focus()} disabled={!pairId || !partnerUid} />
            </View>
          )}
        </View>
      </Card>
    );

  const header = topTab === 'shared' ? headerShared : headerPersonal;

  return (
    <SafeAreaView style={[s.screen, { paddingTop: t.spacing.md }]} edges={['top', 'left', 'right']}>
      {showConfetti ? <ConfettiTiny /> : null}

      <KeyboardAvoidingView behavior={Platform.select({ ios: 'padding', android: undefined })} style={{ flex: 1 }}>
        <FlatList
          data={data}
          keyExtractor={(i) => i.id}
          ItemSeparatorComponent={() => <View style={{ height: t.spacing.s }} />}
          renderItem={renderItem}
          ListHeaderComponent={header}
          contentContainerStyle={{ paddingBottom: insets.bottom + t.spacing.xl, paddingHorizontal: t.spacing.md }}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={emptyBlock}
        />

        <ToastUndo
          visible={toast.visible}
          message={toast.msg}
          onAction={toast.undo}
          onHide={() => setToast({ visible: false, msg: '' })}
        />

        {/* Rewards modal + spotlight nur im Shared-Tab */}
        {topTab === 'shared' && (
          <>
            <RedeemModal
              visible={showAddReward}
              onClose={() => setShowAddReward(false)}
              // Fallback: falls Modal nur (title, cost) liefert
              onCreate={(title: string, cost: number) => onCreateReward(title, cost)}
              // Neu: Modal enthält Tabs (Shared/Personal) und gibt scope zurück
              onCreateWithScope={(title: string, cost: number, scope: RewardScope) =>
                onCreateReward(title, cost, scope)
              }
              // Vorbelegung der Tabs im Modal passend zur aktuellen Listen-Ansicht
              initialScope={rewardScope}
              // Optionaler Hint fürs Modal, dass es die Scope-Navigation anzeigen soll
              showScopeTabs
            />
            <SpotlightAutoStarter uid={user?.uid ?? null} steps={TASKS_TOUR_STEPS} persistKey="tour-tasks-shared-only" />
          </>
        )}
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

    topTabs: {
      flexDirection: 'row',
      gap: 8,
      paddingHorizontal: t.spacing.md,
      marginBottom: t.spacing.s,
    },
    tab: {
      paddingHorizontal: t.spacing.md,
      paddingVertical: 10,
      borderRadius: 999,
      backgroundColor: t.colors.card,
      borderWidth: 1,
      borderColor: t.colors.border,
    },
    tabActive: {
      backgroundColor: t.colors.primary,
      borderColor: t.colors.primary,
    },

    subTabs: {
      flexDirection: 'row',
      gap: 8,
      paddingHorizontal: t.spacing.md,
      marginBottom: t.spacing.s,
    },
    subTab: {
      paddingHorizontal: t.spacing.md,
      paddingVertical: 9,
      borderRadius: 999,
      backgroundColor: t.colors.card,
      borderWidth: 1,
      borderColor: t.colors.border,
    },
    subTabActive: {
      backgroundColor: t.colors.primary,
      borderColor: t.colors.primary,
    },

    // Non-wrapping header row for Shared section
    headerRowNoWrap: {
      paddingHorizontal: t.spacing.md,
      paddingTop: t.spacing.md,
      paddingBottom: t.spacing.s,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'nowrap',
      columnGap: 8,
    },

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

    miniBtn: {
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: t.colors.card,
      borderWidth: 1,
      borderColor: t.colors.border,
      flexDirection: 'row',
      alignItems: 'center',
    },
    miniBtnText: { marginLeft: 6 },
    pointsPicker: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: 10,
      borderRadius: 999,
      backgroundColor: t.colors.card,
      borderWidth: 1,
      borderColor: withAlpha(t.colors.primary, 0.25),
      marginRight: t.spacing.s,
    },
    pointsPickerText: { marginLeft: 6 },

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

    itemCard: { marginBottom: t.spacing.s },
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
      paddingHorizontal: t.spacing.md,
    },
    foldChevron: { marginLeft: 8 },

    rewardsTabs: {
      flexDirection: 'row',
      gap: 8,
      paddingHorizontal: t.spacing.md,
      paddingBottom: 6,
    },
  });

export default TasksScreen;