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
  InteractionManager,
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

import type { DocumentData, Query, QuerySnapshot } from 'firebase/firestore';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
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

import {
  createPointsEntry,
  deletePointsEntry,
  listenOwnerPersonalPointsInPair,
  listenOwnerSoloPoints,
  listenPairSharedPoints,
} from '../utils/points';
import { listenDoc } from '../utils/snap';
import { activateCatchup, isoWeekStr, notifyTaskCompletion } from '../utils/streak';

import RedeemModal from '../components/RedeemModal';
import { getPartnerUid } from '../utils/partner';
import { getUserExpoTokens, sendToUid } from '../utils/push';
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
  forUid?: string | null;
  worth?: number;
};

type RewardScope = 'shared' | 'personal';
type TopTab = 'shared' | 'personal';
type PersonalTab = 'yours' | 'partners';

type RewardSuggestion = { title: string; cost: number };

const REWARD_SUGGESTIONS: { shared: RewardSuggestion[]; personal: RewardSuggestion[] } = {
  shared: [
    { title: 'Coffee date together', cost: 12 },
    { title: 'You choose the movie (date night)', cost: 10 },
    { title: 'Dessert run together', cost: 5 },
    { title: 'Board game + snacks evening', cost: 15 },
    { title: 'Homemade brunch for two', cost: 18 },
    { title: 'Takeout night', cost: 25 },
    { title: 'Tech-free evening', cost: 15 },
    { title: 'Picnic in the park', cost: 25 },
    { title: 'At-home spa night', cost: 30 },
    { title: 'Surprise mini-adventure', cost: 40 },
    { title: 'Skip dishes tonight (both)', cost: 22 },
    { title: 'Weekend day trip', cost: 35 },
  ],
  personal: [
    { title: '10-minute back rub', cost: 8 },
    { title: 'Sleep-in pass', cost: 15 },
    { title: 'One chore off your plate', cost: 15 },
    { title: 'Favorite snack delivery', cost: 6 },
    { title: '1-hour uninterrupted me-time', cost: 20 },
    { title: 'You pick the next show', cost: 5 },
    { title: 'Coffee in bed', cost: 10 },
    { title: 'Playlist control for a week', cost: 12 },
    { title: 'Foot massage', cost: 10 },
    { title: 'You choose dinner', cost: 12 },
    { title: 'Surprise treat just for you', cost: 10 },
    { title: 'I’ll do your least favorite chore', cost: 25 },
  ],
};

const PARTNER_TASK_SUGGESTIONS: string[] = [
  'Book our next date night',
  'Walk the dog',
  'Take out the trash',
  'Fold the laundry',
  'Tidy the living room',
  'Vacuum the floor',
  'Water the plants',
  'Pick up a few groceries',
  'Plan a weekend activity',
  'Handle one admin task (bill/appointment)',
  'Refuel the car',
  'Check the mailbox',
];

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

const nextTick = () => new Promise<void>((r) => setTimeout(r, 0));
const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** 🎉 Keep heavy work behind the celebration (shorter timings) */
const CONFETTI_MS_DEFAULT = 650;
const PUSH_EXTRA_HOLD_MS = 350;
const MIN_PUSH_DELAY_MS  = 450;

// ─────────────────────────────────────────────
// Confetti event bus + always-mounted overlay
// ─────────────────────────────────────────────
const CONFETTI_EVENT = 'lp:confetti:play';
const playConfetti = (durationMs = CONFETTI_MS_DEFAULT) =>
  DeviceEventEmitter.emit(CONFETTI_EVENT, { durationMs });

const OVERLAY_STYLE = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 9999,
    elevation: 9999,
  },
});

/** Always-mounted overlay; only this re-renders when firing confetti */
const ConfettiOverlay: React.FC = React.memo(() => {
  const [visible, setVisible] = React.useState(false);
  const [key, setKey] = React.useState(0);

  React.useEffect(() => {
    const sub = DeviceEventEmitter.addListener(
      CONFETTI_EVENT,
      ({ durationMs = CONFETTI_MS_DEFAULT } = {}) => {
        setKey((k) => k + 1); // remount to replay instantly
        setVisible(true);
        requestAnimationFrame(() => {
          setTimeout(() => setVisible(false), durationMs);
        });
      }
    );
    return () => sub.remove();
  }, []);

  // Prewarm so first play is hot
  return (
    <>
      <View style={{ width: 0, height: 0, opacity: 0 }} pointerEvents="none">
        <ConfettiTiny />
      </View>
      {visible && (
        <View
          pointerEvents="none"
          style={OVERLAY_STYLE.root}
          renderToHardwareTextureAndroid
          shouldRasterizeIOS
        >
          <ConfettiTiny key={key} />
        </View>
      )}
    </>
  );
});

/** Apply Firestore docChanges to an existing array without rebuilding everything */
function applyTaskDocChanges(prev: TaskDoc[], changes: any[]): TaskDoc[] {
  if (!changes?.length) return prev;
  const map = new Map(prev.map((t) => [t.id, t]));
  let touched = false;

  for (const ch of changes) {
    const id = ch.doc.id;
    if (ch.type === 'removed') {
      if (map.delete(id)) touched = true;
      continue;
    }
    const next = { id, ...(ch.doc.data() as Omit<TaskDoc, 'id'>) };
    map.set(id, next);
    touched = true;
  }

  if (!touched) return prev;
  const arr = Array.from(map.values());
  arr.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
  return arr;
}

const TasksScreen: React.FC = () => {
  // ──────────────────────────
  // Celebration → hard gate
  // ──────────────────────────
  const celebrationGateUntilRef = useRef<number>(0);

  // Wait for current confetti window AND UI interactions to finish.
  // Also enforce a minimum push delay even if no confetti ran.
  const afterConfettiIdle = React.useCallback(async () => {
    const minUntil = Date.now() + MIN_PUSH_DELAY_MS;
    if (minUntil > celebrationGateUntilRef.current) {
      celebrationGateUntilRef.current = minUntil;
    }
    const waitMs = celebrationGateUntilRef.current - Date.now();
    if (waitMs > 0) await delay(waitMs);
    await new Promise<void>((resolve) => {
      InteractionManager.runAfterInteractions(() => resolve());
    });
    await nextTick(); // let the frame commit
  }, []);

  // Start confetti immediately and extend the hold window; do not await.
  const showConfettiNow = React.useCallback((durationMs = CONFETTI_MS_DEFAULT) => {
    const holdUntil = Date.now() + durationMs + PUSH_EXTRA_HOLD_MS;
    if (holdUntil > celebrationGateUntilRef.current) {
      celebrationGateUntilRef.current = holdUntil;
    }
    // Fire instantly without re-rendering TasksScreen
    playConfetti(durationMs);
  }, []);

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

  const LA = React.useCallback(() => {
    if (Platform.OS === 'ios') {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
  }, []);

  const [pairId, setPairId] = useState<string | null>(null);
  const [topTab, setTopTab] = useState<TopTab>('shared');
  const [personalTab, setPersonalTab] = useState<PersonalTab>('yours');

  const partnerUid = usePartnerUid(user?.uid ?? null);

  // ───────────── Push helpers (delay until after confetti) ─────────────
  const resolvePartnerUid = async (): Promise<string | null> => {
    if (!user?.uid) return null;

    if (pairId) {
      try {
        const psnap = await getDoc(doc(db, 'pairs', pairId));
        if (psnap.exists()) {
          const members: string[] = (psnap.data() as any)?.members ?? [];
          const other = members.find((u) => u && u !== user.uid) ?? null;
          if (other) return other;
        }
      } catch (e) {
        console.log('[tasks] resolvePartnerUid via pair failed:', e);
      }
    }

    try {
      const p = await getPartnerUid(user.uid);
      if (p && p !== user.uid) return p;
    } catch (e) {
      console.log('[tasks] resolvePartnerUid via user failed:', e);
    }

    return null;
  };

  const sendPartnerPush = async (
    toUid: string | null,
    msg: { title: string; body: string; data?: Record<string, any>; channelId?: string }
  ) => {
    await afterConfettiIdle(); // 👈 hard guarantee: push happens after visuals

    if (!user?.uid) return;
    if (!toUid) {
      console.log('[tasks] sendPartnerPush → no toUid resolved');
      return;
    }
    if (toUid === user.uid) {
      console.log('[tasks] sendPartnerPush → toUid == self, skipping');
      return;
    }

    let tokenCount = 0;
    try {
      const tokens = await getUserExpoTokens(toUid);
      tokenCount = tokens?.length || 0;
    } catch (e) {
      console.log('[tasks] getUserExpoTokens failed:', e);
    }

    try {
      await addDoc(collection(db, 'pushOutbox'), {
        type: 'custom',
        toUid,
        pairId: pairId ?? null,
        actorUid: user.uid,
        title: msg.title,
        body: msg.body,
        data: msg.data ?? {},
        channelId: msg.channelId ?? 'messages',
        createdAt: serverTimestamp(),
        status: 'queued',
        client: Platform.OS,
      });
    } catch (e) {
      console.log('[tasks] enqueue outbox failed:', e);
    }

    try {
      // Fire-and-forget-ish: don't block UI thread’s next renders
      void sendToUid(toUid, {
        title: msg.title,
        body: msg.body,
        data: msg.data,
        channelId: msg.channelId ?? 'messages',
        priority: 'high',
      }).catch((e) => console.log('[tasks] sendToUid → error:', e));
    } catch (e) {
      console.log('[tasks] sendToUid → error outer:', e);
    }
  };

  async function enqueuePartnerPushRewardRedeemed(rewardTitle: string, scope: RewardScope) {
    const toUid = await resolvePartnerUid();
    const title = 'Reward redeemed';
    const body  = `${user?.displayName || 'Your partner'} redeemed “${rewardTitle}”${scope === 'personal' ? ' (personal)' : ''}.`;
    const data  = { pairId: pairId ?? null, rewardTitle, scope };
    await sendPartnerPush(toUid, { title, body, data, channelId: 'messages' });
  }

  async function pushPointsAwardShared(item: TaskDoc, amount: number) {
    const toUid = await resolvePartnerUid();
    const title = 'Point awarded';
    const body  = `${user?.displayName || 'Your partner'} added +${amount} point${amount === 1 ? '' : 's'} to “${item.title}”.`;
    const data  = { kind: 'lp:taskAward', scope: 'shared', taskId: item.id, amount, pairId: item.pairId ?? pairId ?? null };
    await sendPartnerPush(toUid, { title, body, data, channelId: 'messages' });
  }

  async function pushPointsAwardPersonal(item: TaskDoc, amount: number, recipientUid: string) {
    const toUid = recipientUid && recipientUid !== user?.uid ? recipientUid : null;
    const title = 'You earned points';
    const body  = `${user?.displayName || 'Your partner'} gave you +${amount} point${amount === 1 ? '' : 's'} for “${item.title}”.`;
    const data  = { kind: 'lp:taskAward', scope: 'personal', taskId: item.id, amount, pairId: item.pairId ?? pairId ?? null };
    await sendPartnerPush(toUid, { title, body, data, channelId: 'messages' });
  }

  const prevPairRef = useRef<string | null>(null);
  const [tasks, setTasks] = useState<TaskDoc[]>([]);
  const [rewards, setRewards] = useState<RewardDoc[]>([]);

  const [rewardScope, setRewardScope] = useState<RewardScope>('shared');
  const [personalRedeemable, setPersonalRedeemable] = useState(0);
  const [spentPersonalSum, setSpentPersonalSum] = useState(0);
  const [spentSharedSum, setSpentSharedSum] = useState(0);
  const [partnerPersonalRedeemable, setPartnerPersonalRedeemable] = useState(0);
  const [spentPersonalSumPair, setSpentPersonalSumPair] = useState(0);

  const [title, setTitle] = useState('');
  const [titlePersonal, setTitlePersonal] = useState('');
  const [sharedWorth, setSharedWorth] = useState<number>(1);
  const [personalWorth, setPersonalWorth] = useState<number>(1);

  const [titleError, setTitleError] = useState<string | undefined>(undefined);
  const inputRef = useRef<any>(null);
  const inputPersonalRef = useRef<any>(null);

  const [toast, setToast] = useState<{ visible: boolean; msg: string; undo?: () => Promise<void> | void; }>({ visible: false, msg: '' });
  const showUndo = (message: string, undo?: () => Promise<void> | void) => setToast({ visible: true, msg: message, undo });


  const confettiSeenTodayRef = useRef(false);
  const { uid: _uid } = user ?? {};
  useEffect(() => {
    (async () => {
      if (!_uid) { confettiSeenTodayRef.current = false; return; }
      try {
        const seen = await AsyncStorage.getItem(FIRST_DONE_KEY(_uid));
        confettiSeenTodayRef.current = !!seen;
      } catch {}
    })();
  }, [_uid]);

  const [showAddReward, setShowAddReward] = useState(false);

  const REWARDS_OPEN_KEY = (uid?: string | null) => `lp:tasks:rewardsOpen:${uid ?? 'anon'}`;
  const SHARED_SUGG_OPEN_KEY = (uid?: string | null) => `lp:tasks:sharedSuggOpen:${uid ?? 'anon'}`;
  const PARTNER_SUGG_OPEN_KEY = (uid?: string | null) => `lp:tasks:partnerSuggOpen:${uid ?? 'anon'}`;
  const [rewardsOpen, setRewardsOpen] = useState(true);
  const [sharedSuggOpen, setSharedSuggOpen] = useState(true);
  const [partnerSuggOpen, setPartnerSuggOpen] = useState(true);

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
        const stored = await AsyncStorage.getItem(SHARED_SUGG_OPEN_KEY(user?.uid));
        if (stored === '0') setSharedSuggOpen(false);
        else if (stored === '1') setSharedSuggOpen(true);
      } catch {}
    })();
  }, [user?.uid]);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(PARTNER_SUGG_OPEN_KEY(user?.uid));
        if (stored === '0') setPartnerSuggOpen(false);
        else if (stored === '1') setPartnerSuggOpen(true);
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

  useEffect(() => {
    (async () => {
      try {
        await AsyncStorage.setItem(SHARED_SUGG_OPEN_KEY(user?.uid), sharedSuggOpen ? '1' : '0');
      } catch {}
    })();
  }, [sharedSuggOpen, user?.uid]);

  useEffect(() => {
    (async () => {
      try {
        await AsyncStorage.setItem(PARTNER_SUGG_OPEN_KEY(user?.uid), partnerSuggOpen ? '1' : '0');
      } catch {}
    })();
  }, [partnerSuggOpen, user?.uid]);

  const toggleRewardsOpen = () => {
    LA();
    setRewardsOpen((v) => !v);
  };
  const toggleSharedSuggOpen = () => {
    LA();
    setSharedSuggOpen((v) => !v);
  };
  const togglePartnerSuggOpen = () => {
    LA();
    setPartnerSuggOpen((v) => !v);
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

  // Redemptions
  useEffect(() => {
    if (!pairId || !user?.uid) {
      setSpentSharedSum(0);
      setSpentPersonalSum(0);
      setSpentPersonalSumPair(0);
      return;
    }
    const qRef = query(collection(db, 'rewardRedemptions'), where('pairId', '==', pairId));
    const unsub = onSnapshot(
      qRef,
      (snap) => {
        let shared = 0;
        let personalMine = 0;
        let personalAll = 0;
        for (const d of snap.docs) {
          const data: any = d.data();
          const v = Number(data?.cost ?? 0);
          if (!Number.isFinite(v) || v <= 0) continue;
          const scope = String(data?.scope ?? 'shared').toLowerCase();
          if (scope === 'shared') {
            shared += v;
          } else if (scope === 'personal') {
            personalAll += v;
            if (data?.redeemedBy === user.uid) personalMine += v;
          }
        }
        setSpentSharedSum(shared);
        setSpentPersonalSum(personalMine);
        setSpentPersonalSumPair(personalAll);
      },
      () => {
        setSpentSharedSum(0);
        setSpentPersonalSum(0);
        setSpentPersonalSumPair(0);
      }
    );
    return () => unsub && unsub();
  }, [pairId, user?.uid]);

  // Tasks listener
  useEffect(() => {
    if (!user || !pairId) {
      setTasks([]);
      return;
    }

    const baseCol = collection(db, 'tasks');
    const qWithOrder = query(baseCol, where('pairId', '==', pairId), orderBy('createdAt', 'desc'));

    let unsub: undefined | (() => void);

    const start = (qToUse: Query<DocumentData>) => {
      unsub = onSnapshot(
        qToUse,
        (snap: QuerySnapshot<DocumentData>) => {
          setTasks((prev) => applyTaskDocChanges(prev, snap.docChanges()));
        },
        (err: any) => {
          if ((err as any)?.code === 'failed-precondition' && qToUse === qWithOrder) {
            const qNoOrder = query(baseCol, where('pairId', '==', pairId));
            start(qNoOrder);
          } else {
            console.warn('[firestore] tasks listener error', err);
          }
        }
      );
    };

    start(qWithOrder);
    return () => unsub && unsub();
  }, [user, pairId]);

  // Streak doc
  useEffect(() => {
    if (!user) return;
    const ref = doc(db, 'streaks', user.uid);
    const off = listenDoc(ref, (snap) => setStreak(snap.exists() ? (snap.data() as any) : null), 'streaks');
    return () => off && off();
  }, [user]);

  // -------- LIVE totals -----------------------
  const [pairTotalLive, setPairTotalLive] = useState<number>(0);
  const [ownerSoloLive, setOwnerSoloLive] = useState<number>(0);
  const [totalOptimistic, setTotalOptimistic] = useState<{ bump: number; baselinePair: number; baselineOwner: number } | null>(null);

  useEffect(() => {
    if (!pairId) { setPairTotalLive(0); return; }
    const unsub = listenPairSharedPoints(pairId, (total) => setPairTotalLive(total));
    return () => { try { unsub(); } catch {} };
  }, [pairId]);

  useEffect(() => {
    if (!user?.uid) {
      setOwnerSoloLive(0);
      return;
    }
    const unsub = listenOwnerSoloPoints(user.uid, (total) => setOwnerSoloLive(total));
    return () => unsub && unsub();
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid || !pairId) {
      setPersonalRedeemable(0);
      return;
    }
    const unsub = listenOwnerPersonalPointsInPair(user.uid, pairId, (total) => setPersonalRedeemable(total));
    return () => unsub && unsub();
  }, [user?.uid, pairId]);

  useEffect(() => {
    if (!pairId || !partnerUid) {
      setPartnerPersonalRedeemable(0);
      return;
    }
    const unsub = listenOwnerPersonalPointsInPair(partnerUid, pairId, (total) => setPartnerPersonalRedeemable(total));
    return () => unsub && unsub();
  }, [pairId, partnerUid]);

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

  // ---- Rewards balances ----------------------
  const effectiveSpentShared = spentSharedSum;
  const effectiveSpentPersonalMine = spentPersonalSum;
  const effectiveSpentPersonalAll  = spentPersonalSumPair;

  const sharedEarnedFromTasks = useMemo(() => {
    return tasks.reduce((sum, t) => {
      const isShared = (t.kind ?? 'shared') !== 'personal';
      if (!isShared) return sum;
      return sum + (Number(t.points) || 0);
    }, 0);
  }, [tasks]);

  const baseShared = Math.max(pairTotalDisplay ?? 0, sharedEarnedFromTasks ?? 0);
  const pairPersonalTotal = (personalRedeemable ?? 0) + (partnerPersonalRedeemable ?? 0);

  const sharedAvailableForRewards = useMemo(() => {
    return Math.max(0, (baseShared + pairPersonalTotal) - (effectiveSpentShared + effectiveSpentPersonalAll));
  }, [baseShared, pairPersonalTotal, effectiveSpentShared, effectiveSpentPersonalAll]);

  const personalAvailableForRewards = useMemo(() => {
    return Math.max(0, (personalRedeemable ?? 0) - (effectiveSpentPersonalMine ?? 0));
  }, [personalRedeemable, effectiveSpentPersonalMine]);

  // 🔥 Optimistic local patch helper
  const patchTaskLocal = React.useCallback((id: string, patch: Partial<TaskDoc>) => {
    setTasks(prev => prev.map(t => (t.id === id ? { ...t, ...patch } : t)));
  }, []);

  /* ──────────────────────────────────────────── */
  /* SHARED                                      */
  /* ──────────────────────────────────────────── */

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
      LA();
      setTitle('');
      Keyboard.dismiss();
      showUndo('Nice! Added to the shared list.');
    } catch (e: any) {
      Alert.alert('Couldn’t add task', e?.message ?? 'Please try again.');
    }
  }

  async function handleToggleDoneShared(item: TaskDoc) {
    const nextDone = !item.done;

    // Show confetti immediately
    showConfettiNow(900);

    // Move local UI update to the very next frame so confetti paints first
    requestAnimationFrame(() => {
      patchTaskLocal(item.id, { done: nextDone });
      LA();
    });

    // Heavy work (and undo) after confetti + interactions
    void (async () => {
      try {
        await afterConfettiIdle();
        await updateDoc(doc(db, 'tasks', item.id), {
          done: nextDone,
          updatedAt: serverTimestamp(),
          ownerId: item.ownerId,
          pairId: item.pairId ?? null,
        });

        if (nextDone && user) {
          await notifyTaskCompletion(user.uid).catch(() => {});
        }

        showUndo(nextDone ? 'Marked complete' : 'Marked incomplete', async () => {
          patchTaskLocal(item.id, { done: item.done ?? false });
          await updateDoc(doc(db, 'tasks', item.id), {
            done: item.done ?? false,
            updatedAt: serverTimestamp(),
            ownerId: item.ownerId,
            pairId: item.pairId ?? null,
          });
        });
      } catch (e: any) {
        patchTaskLocal(item.id, { done: item.done ?? false });
        Alert.alert('Update failed', e?.message ?? 'Please try again.');
      }
    })();
  }

  // 🎉 Confetti first, local UI on next frame, heavy work AFTER confetti + interactions
  async function awardPointsShared(item: TaskDoc, amount: number) {
    if (!user) return;
    const nextPoints = (item.points ?? 0) + amount;

    // Show confetti immediately
    showConfettiNow(800);

    // Local UI update on next frame ⇒ guarantees confetti paints first
    requestAnimationFrame(() => {
      if ((React as any).startTransition) {
        (React as any).startTransition(() => {
          patchTaskLocal(item.id, { points: nextPoints });
          setPairTotalLive((p) => (p ?? 0) + amount);
        });
      } else {
        patchTaskLocal(item.id, { points: nextPoints });
        setPairTotalLive((p) => (p ?? 0) + amount);
      }
    });

    // Heavy work later, completely decoupled from UI frame
    void (async () => {
      try {
        await afterConfettiIdle();

        const pidToUse = item.pairId ?? pairId ?? null;
        const pointsId = await createPointsEntry({
          ownerId: user.uid,
          pairId: pidToUse,
          value: amount,
          reason: `Task: ${item.title}`,
          taskId: item.id,
          scope: 'shared',
          kind: 'shared',
        });

        await updateDoc(doc(db, 'tasks', item.id), {
          points: nextPoints,
          updatedAt: serverTimestamp(),
          ownerId: item.ownerId,
          pairId: item.pairId ?? null,
        });

        await pushPointsAwardShared(item, amount);

        LA();

        showUndo(`+${amount} point${amount === 1 ? '' : 's'} added 🎉`, async () => {
          await deletePointsEntry(pointsId, pidToUse ?? undefined);
          const rolledBack = Math.max(0, (item.points ?? 0));
          patchTaskLocal(item.id, { points: rolledBack });
          setPairTotalLive((p) => Math.max(0, (p ?? 0) - amount));
          await updateDoc(doc(db, 'tasks', item.id), {
            points: rolledBack,
            updatedAt: serverTimestamp(),
            ownerId: item.ownerId,
            pairId: item.pairId ?? null,
          });
        });
      } catch (e: any) {
        patchTaskLocal(item.id, { points: item.points ?? 0 });
        setPairTotalLive((p) => Math.max(0, (p ?? 0) - amount));
        Alert.alert('Could not award points', e?.message ?? 'Please try again.');
      }
    })();
  }

  async function handleAwardPointShared(item: TaskDoc) {
    const amount = Math.max(1, Number(item.worth) || 1);
    await awardPointsShared(item, amount);
  }

  /* ──────────────────────────────────────────── */
  /* PERSONAL                                    */
  /* ──────────────────────────────────────────── */

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
        ownerId: user.uid,
        forUid: partnerUid,
        pairId,
        kind: 'personal',
        done: false,
        points: 0,
        worth: personalWorth,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      await addDoc(collection(db, 'tasks'), payload);
      LA();
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

    const nextDone = !item.done;

    // Confetti immediately
    showConfettiNow(900);

    // Local UI next frame
    requestAnimationFrame(() => {
      patchTaskLocal(item.id, { done: nextDone });
      LA();
    });

    // Heavy work after confetti
    void (async () => {
      try {
        await afterConfettiIdle();
        await updateDoc(doc(db, 'tasks', item.id), {
          done: nextDone,
          updatedAt: serverTimestamp(),
          ownerId: item.ownerId,
          pairId: item.pairId ?? null,
        });

        showUndo(nextDone ? 'Marked complete' : 'Marked incomplete', async () => {
          patchTaskLocal(item.id, { done: item.done ?? false });
          await updateDoc(doc(db, 'tasks', item.id), {
            done: item.done ?? false,
            updatedAt: serverTimestamp(),
            ownerId: item.ownerId,
            pairId: item.pairId ?? null,
          });
        });
      } catch (e: any) {
        patchTaskLocal(item.id, { done: item.done ?? false });
        Alert.alert('Update failed', e?.message ?? 'Please try again.');
      }
    })();
  }

  async function awardPointsPersonal(item: TaskDoc, amount: number) {
    if (!user || !pairId) return;
    const recipientUid = item.forUid;
    if (!recipientUid || recipientUid === user.uid) return;

    const nextPoints = (item.points ?? 0) + amount;

    // Confetti immediately
    showConfettiNow(800);

    // Local UI next frame
    requestAnimationFrame(() => {
      if ((React as any).startTransition) {
        (React as any).startTransition(() => {
          patchTaskLocal(item.id, { points: nextPoints });
          setPartnerPersonalRedeemable((prev) => prev + amount);
        });
      } else {
        patchTaskLocal(item.id, { points: nextPoints });
        setPartnerPersonalRedeemable((prev) => prev + amount);
      }
    });

    // Heavy work after confetti
    void (async () => {
      try {
        await afterConfettiIdle();

        const pointsId = await createPointsEntry({
          ownerId: recipientUid,
          pairId,
          value: amount,
          reason: `Personal task: ${item.title}`,
          taskId: item.id,
          scope: 'personal',
          kind: 'personal',
          forUid: recipientUid,
        });

        await updateDoc(doc(db, 'tasks', item.id), {
          points: nextPoints,
          updatedAt: serverTimestamp(),
          ownerId: item.ownerId,
          pairId: item.pairId ?? null,
        });

        await pushPointsAwardPersonal(item, amount, recipientUid);

        LA();

        showUndo(`+${amount} point${amount === 1 ? '' : 's'} added for your partner 🎉`, async () => {
          await deletePointsEntry(pointsId, pairId);
          const rolledBack = Math.max(0, (item.points ?? 0));
          patchTaskLocal(item.id, { points: rolledBack });
          setPartnerPersonalRedeemable((prev) => Math.max(0, prev - amount));
          await updateDoc(doc(db, 'tasks', item.id), {
            points: rolledBack,
            updatedAt: serverTimestamp(),
            ownerId: item.ownerId,
            pairId: item.pairId ?? null,
          });
        });
      } catch (e: any) {
        patchTaskLocal(item.id, { points: item.points ?? 0 });
        setPartnerPersonalRedeemable((prev) => Math.max(0, prev - amount));
        Alert.alert('Could not award points', e?.message ?? 'Please try again.');
      }
    })();
  }

  async function handleAwardPointPersonal(item: TaskDoc) {
    const amount = Math.max(1, Number(item.worth) || 1);
    await awardPointsPersonal(item, amount);
  }

  function maybeShowConfettiOnFirstDone() {
    if (!user) return;
    if (confettiSeenTodayRef.current) return;
    confettiSeenTodayRef.current = true;
    showConfettiNow(1000);
    AsyncStorage.setItem(FIRST_DONE_KEY(user.uid), '1').catch(() => {});
  }

  async function handleDelete(item: TaskDoc) {
    const backup = { ...item };
    try {
      await deleteDoc(doc(db, 'tasks', item.id));
      LA();
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

  // Reward creator
  const onCreateReward = async (title: string, cost: number, scopeOverride?: RewardScope) => {
    if (!user) return;
    try {
      await afterConfettiIdle();
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
      await afterConfettiIdle();

      const redemptionRef = await addDoc(collection(db, 'rewardRedemptions'), {
        rewardId: r.id,
        title: r.title,
        cost: r.cost,
        scope,
        pairId: pairId ?? null,
        redeemedBy: user.uid,
        createdAt: serverTimestamp(),
      });

      await notifyRewardRedeemedLocal(user.uid, pairId ?? null, r.title, scope);
      await enqueuePartnerPushRewardRedeemed(r.title, scope);

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
      LA();
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

  /* ──────────────────────────────────────────── */
  /* Derived task buckets                         */
  /* ──────────────────────────────────────────── */

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

  /* ──────────────────────────────────────────── */
  /* Rendering                                    */
  /* ──────────────────────────────────────────── */

  const TASKS_TOUR_STEPS: SpotlightStep[] = useMemo(() => {
    if (topTab !== 'shared') return [];
    const arr: SpotlightStep[] = [
      { id: 'tsk-welcome', targetId: null, title: 'Shared Tasks', text: 'Both partners see and update this list.', placement: 'bottom', allowBackdropTapToNext: true },
      { id: 'tsk-input', targetId: 'ts-input', title: 'Add a task', text: 'Type a small, kind action.' },
      { id: 'tsk-worth', targetId: 'ts-worth', title: 'Set task value', text: 'Tap the +1 to choose how many points this task is worth.', placement: 'top' },
      { id: 'tsk-personal', targetId: 'ts-personal-section', title: 'Personal section', text: 'Switch here to create and award tasks for each person.', placement: 'bottom' },
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
                  +{Math.max(1, Number(item.worth) || 1)} pt{(Math.max(1, Number(item.worth) || 1) === 1 ? '' : 's')}
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
                  +{Math.max(1, Number(item.worth) || 1)} pt{(Math.max(1, Number(item.worth) || 1) === 1 ? '' : 's')}
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

    const filteredRewards = rewards.filter((r: any) => {
      const scope = r?.scope ?? 'shared';
      return rewardScope === 'shared' ? scope !== 'personal' : scope === 'personal';
    });

    return (
      <Card style={{ marginBottom: 12, borderWidth: 1, borderColor: '#F0E6EF' }}>
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

        {rewardsOpen && (
          <>
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
          <ThemedText
            variant="label"
            style={s.tabText}
            color={topTab === 'shared' ? '#fff' : t.colors.text}
          >
            Shared
          </ThemedText>
        </Pressable>

        <Pressable onPress={() => setTopTab('personal')} style={[s.tab, topTab === 'personal' && s.tabActive]}>
          <SpotlightTarget id="ts-personal-section">
            <ThemedText
              variant="label"
              style={s.tabText}
              color={topTab === 'personal' ? '#fff' : t.colors.text}
            >
              Personal
            </ThemedText>
          </SpotlightTarget>
        </Pressable>
      </View>

      {/* Header (force single-line title) */}
      <View style={s.headerRowNoWrap}>
        <ThemedText
          variant="display"
          style={{ flexShrink: 1, minWidth: 0, marginRight: t.spacing.s }}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          Shared tasks
        </ThemedText>
        <Pressable
          onPress={() => setShowAddReward(true)}
          style={s.iconStackBtn}
          accessibilityRole="button"
          accessibilityLabel="Add reward"
          hitSlop={6}
        >
          <Ionicons name="gift-outline" size={22} color={t.colors.primary} />
          <ThemedText
            variant="caption"
            color={t.colors.textDim}
            style={s.iconStackLabel}
          >
            Add reward
          </ThemedText>
        </Pressable>
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

          {/* Bold +N */}
          <SpotlightTarget id="ts-worth">
            <Pressable
              onPress={async () => setSharedWorth(await pickWorth(sharedWorth))}
              style={s.pointsPicker}
              accessibilityRole="button"
              accessibilityLabel="Set task point value"
              hitSlop={8}
            >
              <ThemedText variant="label" style={s.pointsPickerText}>
                +{sharedWorth}
              </ThemedText>
            </Pressable>
          </SpotlightTarget>

          <SpotlightTarget id="ts-add">
            <Button label="Add" onPress={handleAddTask} disabled={!title.trim() || !pairId} />
          </SpotlightTarget>
        </View>

        <ThemedText variant="caption" color={t.colors.textDim} style={{ marginTop: t.spacing.s }}>
          Tap to add to your list.
        </ThemedText>
        <SpotlightTarget id="ts-suggestions">
          <Pressable onPress={toggleSharedSuggOpen} accessibilityRole="button" style={s.foldHeader}>
            <ThemedText variant="subtitle" style={{ flex: 1 }}>
              Suggestions
            </ThemedText>
            <Ionicons
              name="chevron-down"
              size={18}
              color={t.colors.textDim}
              style={[s.foldChevron, sharedSuggOpen && { transform: [{ rotate: '180deg' }] }]}
            />
          </Pressable>
        </SpotlightTarget>
        {sharedSuggOpen && (
          <View style={s.suggestWrap}>
            {['Plan a mini date', 'Write a love note', 'Make coffee', 'Do the dishes', 'Share a song', 'Bring a snack'].map((txt) => (
              <Pressable key={txt} onPress={() => setTitle(txt)} style={s.suggestChip} accessibilityRole="button">
                <ThemedText variant="label">{txt}</ThemedText>
              </Pressable>
            ))}
          </View>
        )}
      </Card>
    </View>
  );

  const headerPersonal = (
    <View>
      {/* Top Tabs */}
      <View style={s.topTabs}>
        <Pressable onPress={() => setTopTab('shared')} style={[s.tab, topTab === 'shared' && s.tabActive]}>
          <ThemedText
            variant="label"
            style={s.tabText}
            color={topTab === 'shared' ? '#fff' : t.colors.text}
          >
            Shared
          </ThemedText>
        </Pressable>
        <Pressable onPress={() => setTopTab('personal')} style={[s.tab, topTab === 'personal' && s.tabActive]}>
          <ThemedText
            variant="label"
            style={s.tabText}
            color={topTab === 'personal' ? '#fff' : t.colors.text}
          >
            Personal
          </ThemedText>
        </Pressable>
      </View>

      <View style={s.headerRow}>
        <ThemedText
          variant="display"
          style={{ flexShrink: 1, minWidth: 0 }}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
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

      {/* Input only in partner tab */}
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
              <ThemedText variant="label" style={s.pointsPickerText}>
                +{personalWorth}
              </ThemedText>
            </Pressable>
            <Button label="Add" onPress={handleAddPersonalTask} disabled={!titlePersonal.trim() || !pairId || !partnerUid} />
          </View>
          <ThemedText variant="caption" color={t.colors.textDim} style={{ marginTop: t.spacing.s }}>
            Create tasks your partner should do. You can give them points here.
          </ThemedText>
          <Pressable onPress={togglePartnerSuggOpen} accessibilityRole="button" style={s.foldHeader}>
            <ThemedText variant="subtitle" style={{ flex: 1 }}>
              Suggestions
            </ThemedText>
            <Ionicons
              name="chevron-down"
              size={18}
              color={t.colors.textDim}
              style={[s.foldChevron, partnerSuggOpen && { transform: [{ rotate: '180deg' }] }]}
            />
          </Pressable>
          {partnerSuggOpen && (
            <View style={s.suggestWrap}>
              {PARTNER_TASK_SUGGESTIONS.map((txt) => (
                <Pressable
                  key={txt}
                  onPress={() => setTitlePersonal(txt)}
                  style={s.suggestChip}
                  accessibilityRole="button"
                >
                  <ThemedText variant="label">{txt}</ThemedText>
                </Pressable>
              ))}
            </View>
          )}
        </Card>
      )}
    </View>
  );

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

  const redeemModalExtras: any = {
    suggestionsShared: REWARD_SUGGESTIONS.shared,
    suggestionsPersonal: REWARD_SUGGESTIONS.personal,
    suggestionsTitle: 'Try one of these',
    suggestionsNote: 'Tap a suggestion to autofill title and cost.',
  };

  return (
    <SafeAreaView style={[s.screen, { paddingTop: t.spacing.md }]} edges={['top', 'left', 'right']}>
      <ConfettiOverlay />

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
          removeClippedSubviews
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          updateCellsBatchingPeriod={16}
          windowSize={5}
          showsVerticalScrollIndicator={false}
        />

        <ToastUndo
          visible={toast.visible}
          message={toast.msg}
          onAction={toast.undo}
          onHide={() => setToast({ visible: false, msg: '' })}
        />

        {topTab === 'shared' && (
          <>
            <RedeemModal
              visible={showAddReward}
              onClose={() => setShowAddReward(false)}
              onCreate={(title: string, cost: number) => onCreateReward(title, cost)}
              onCreateWithScope={(title: string, cost: number, scope: RewardScope) =>
                onCreateReward(title, cost, scope)
              }
              initialScope={rewardScope}
              showScopeTabs
              {...redeemModalExtras}
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
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
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
    tabText: {
      fontSize: 14,
      fontWeight: '700',
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

    iconStackBtn: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 12,
      backgroundColor: t.colors.card,
      borderWidth: 1,
      borderColor: t.colors.border,
    },
    iconStackLabel: {
      marginTop: 2,
      lineHeight: 12,
      fontSize: 11,
      textAlign: 'center',
    },

    pointsPicker: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 999,
      backgroundColor: t.colors.card,
      borderWidth: 1,
      borderColor: withAlpha(t.colors.primary, 0.25),
      marginRight: t.spacing.s,
    },
    pointsPickerText: {
      fontWeight: '700',
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