// screens/HomeScreen.tsx
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { useNavigation } from '@react-navigation/native';
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
  type DocumentData,
  type DocumentSnapshot,
  type FirestoreError,
  type Query,
  type QuerySnapshot,
} from 'firebase/firestore';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  DeviceEventEmitter,
  InteractionManager,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import Button from '../components/Button';
import Card from '../components/Card';
import Input from '../components/Input';
import ProgressBar from '../components/ProgressBar';
import Screen from '../components/Screen';
import ThemedText from '../components/ThemedText';
import { useTokens, type ThemeTokens } from '../components/ThemeProvider';

import {
  SpotlightAutoStarter,
  SpotlightTarget,
  type SpotlightStep,
} from '../components/spotlight';

import { db } from '../firebaseConfig';
import useAuthListener from '../hooks/useAuthListener';
import usePointsTotal from '../hooks/usePointsTotal';
import useStreak from '../hooks/useStreak';
import { redeemPairCode } from '../utils/pairing';

import RedeemModal from '../components/RedeemModal';
import { addReward } from '../utils/rewards';

const WEEK_GOAL = 50;
const MILESTONES = [5, 10, 25, 50, 100, 200, 500];

const IDEAS = [
  'Plan a mini date',
  'Sunset photo walk',
  'Bring a snack',
  'Write a love note',
  'Tea + short episode',
  'Make a 5-song playlist',
  '10-minute massage',
  'Cook their favorite',
  'Board game best-of-3',
  'Go for a walk',
];

const isIOS = Platform.OS === 'ios';

// ---- Normalizers shared with Challenges ----
function getPointValue(data: any): number {
  const candidates = [data?.value, data?.points, data?.point, data?.amount, data?.delta, data?.score];
  for (const c of candidates) {
    const n = Number(c);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}
function getDocDate(data: any): Date | null {
  const fields = ['createdAt', 'timestamp', 'ts', 'time', 'date'];
  for (const k of fields) {
    const v: any = data?.[k];
    if (!v) continue;
    try {
      if (typeof v?.toDate === 'function') {
        const d = v.toDate();
        if (!Number.isNaN(+d)) return d;
      } else if (typeof v === 'number') {
        const ms = v > 1e12 ? v : v * 1000; // support seconds
        const d = new Date(ms);
        if (!Number.isNaN(+d)) return d;
      } else if (typeof v === 'string') {
        const d = new Date(v);
        if (!Number.isNaN(+d)) return d;
      }
    } catch {}
  }
  return null;
}
function dedupeKey(data: any, id: string) {
  return String(data?.idempotencyKey ?? id);
}
function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}
function dayKey() {
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}
const offsetFromKey = (k: number) => k % IDEAS.length;
const withAlpha = (hex: string, alpha: number) => {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const a = Math.round(alpha * 255).toString(16).padStart(2, '0');
  return `#${full}${a}`;
};

const HAIRLINE = '#F0E6EF';
const CHIP_BG = '#F3EEF6';

const Pill = ({ children }: { children: React.ReactNode }) => (
  <View
    accessibilityRole="text"
    style={{
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: CHIP_BG,
      borderWidth: 1,
      borderColor: HAIRLINE,
      gap: 8,
    }}
  >
    {children}
  </View>
);

function nextMilestone(total: number) {
  for (const m of MILESTONES) if (total < m) return { target: m, remaining: m - total };
  const target = MILESTONES[MILESTONES.length - 1] * 2;
  return { target, remaining: Math.max(0, target - total) };
}

type PairHint = 'linked' | 'unlinked' | 'unknown';

/** Monday 00:00 UTC (ISO-week) */
function startOfWeekMondayUTC(d = new Date()) {
  const copy = new Date(d);
  const day = copy.getUTCDay(); // 0=Sun..6=Sat
  const diffToMon = (day + 6) % 7;
  copy.setUTCHours(0, 0, 0, 0);
  copy.setUTCDate(copy.getUTCDate() - diffToMon);
  return copy;
}
function weekKeyUTC(d = new Date()) {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = (date.getUTCDay() + 6) % 7; // Mon..Sun
  date.setUTCDate(date.getUTCDate() - day + 3); // Thu
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const firstDay = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDay + 3);
  const weekNo = 1 + Math.round((date.getTime() - firstThursday.getTime()) / (7 * 24 * 3600 * 1000));
  const year = date.getUTCFullYear();
  return `${year}-W${String(weekNo).padStart(2, '0')}`;
}
function extractPartnerUidFromPairDoc(d: any, myUid: string): string | null {
  if (!d) return null;
  if (d.userA && d.userB) return d.userA === myUid ? d.userB : d.userA;
  if (d.ownerId && d.partnerId) return d.ownerId === myUid ? d.partnerId : d.ownerId;
  if (Array.isArray(d.members)) return d.members.find((u: string) => u && u !== myUid) ?? null;
  if (Array.isArray(d.userIds)) return d.userIds.find((u: string) => u && u !== myUid) ?? null;
  if (d.a && d.b) return d.a === myUid ? d.b : d.a;
  return null;
}

export default function HomeScreen() {
  const t = useTokens();
  const s = useMemo(() => styles(t), [t]);
  const nav = useNavigation<any>();

  const { user } = useAuthListener();
  const { total, weekly } = usePointsTotal(user?.uid);
  const streak = useStreak(user?.uid);

  const [pairId, setPairId] = useState<string | null>(null);
  const [partnerUid, setPartnerUid] = useState<string | null>(null);
  const [pairReady, setPairReady] = useState(false);
  const [pairHint, setPairHint] = useState<PairHint>('unknown');
  const [isOnline, setIsOnline] = useState<boolean | null>(null);

  const [showAddReward, setShowAddReward] = useState(false);

  // CODE PROMPT (Android + fallback)
  const [codePromptVisible, setCodePromptVisible] = useState(false);
  const [codeText, setCodeText] = useState('');
  const [codeBusy, setCodeBusy] = useState(false);

  // Spotlight gating
  const [linkReady, setLinkReady] = useState(false);
  const [logReady, setLogReady] = useState(false);
  const [rewardReady, setRewardReady] = useState(false);
  const [settingsReady, setSettingsReady] = useState(false);
  const [interactionsDone, setInteractionsDone] = useState(false);
  const [navReady, setNavReady] = useState(false);

  // 🔴 LIVE weekly & total
  const [weeklyLive, setWeeklyLive] = useState<number | null>(null);
  const [totalLive, setTotalLive] = useState<number | null>(null);

  // ✅ Optimistic bumps
  const [weeklyOptimistic, setWeeklyOptimistic] = useState<{ bump: number; baseline: number } | null>(null);
  const [totalOptimistic, setTotalOptimistic] = useState<{ bump: number; baseline: number } | null>(null);

  // ---- Network status
  useEffect(() => {
    const sub = NetInfo.addEventListener((state) => {
      setIsOnline(state.isInternetReachable ?? state.isConnected ?? null);
    });
    return () => sub();
  }, []);

  // ---- Load cached pair hint quickly on login
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user?.uid) {
        setPairHint('unknown');
        return;
      }
      try {
        const v = await AsyncStorage.getItem(`pairState:${user.uid}`);
        if (!cancelled) {
          if (v === 'linked' || v === 'unlinked') setPairHint(v);
          else setPairHint('unknown');
        }
      } catch {
        if (!cancelled) setPairHint('unknown');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

  // ---- Live pairId from user doc
  useEffect(() => {
    if (!user?.uid) {
      setPairId(null);
      setPairReady(false);
      return;
    }
    setPairReady(false);

    const unsub = onSnapshot(
      doc(db, 'users', user.uid),
      { includeMetadataChanges: true },
      async (snap) => {
        const pid = snap.exists() ? (snap.data() as any)?.pairId ?? null : null;
        setPairId(pid);

        const newHint: PairHint = pid ? 'linked' : 'unlinked';
        setPairHint(newHint);
        try { await AsyncStorage.setItem(`pairState:${user.uid}`, newHint); } catch {}

        const fromServer = !snap.metadata.fromCache;
        const noPending = !snap.metadata.hasPendingWrites;
        if ((fromServer && noPending) || (isOnline === false && noPending)) {
          setPairReady(true);
        }
      },
      () => {
        setPairId(null);
        setPairReady(false);
      }
    );

    return () => unsub();
  }, [user?.uid, isOnline]);

  // ---- Partner UID from pair doc
  useEffect(() => {
    if (!user?.uid || !pairId) {
      setPartnerUid(null);
      return;
    }
    const ref = doc(db, 'pairs', pairId);
    const off = onSnapshot(
      ref,
      (snap: DocumentSnapshot<DocumentData>) => {
        if (!snap.exists()) {
          setPartnerUid(null);
          return;
        }
        const data = snap.data();
        setPartnerUid(extractPartnerUidFromPairDoc(data, user.uid));
      },
      () => setPartnerUid(null)
    );
    return () => off();
  }, [user?.uid, pairId]);

  // ---- LIVE weekly total (pair-first; positive only)
  useEffect(() => {
    if (!user?.uid) {
      setWeeklyLive(null);
      return;
    }

    const since = startOfWeekMondayUTC();
    const until = new Date(since);
    until.setUTCDate(until.getUTCDate() + 7);

    const sinceTs = Timestamp.fromDate(since);
    const baseRef = collection(db, 'points');

    const buf = new Map<string, any>();
    const recompute = () => {
      let sum = 0;
      for (const data of buf.values()) {
        const v = getPointValue(data);
        const dt = getDocDate(data);
        if (dt && dt >= since && dt < until && Number.isFinite(v) && v > 0) sum += v;
      }
      setWeeklyLive(sum);
    };

    const unsubs: Array<() => void> = [];

    function add(qRef: Query<DocumentData>, fbRef?: Query<DocumentData>) {
      const off = onSnapshot(
        qRef,
        (snap: QuerySnapshot<DocumentData>) => {
          for (const d of snap.docs) buf.set(dedupeKey(d.data(), d.id), d.data());
          recompute();
        },
        (_err: FirestoreError) => {
          if (!fbRef) return;
          const offFb = onSnapshot(fbRef, (snap2: QuerySnapshot<DocumentData>) => {
            for (const d of snap2.docs) buf.set(dedupeKey(d.data(), d.id), d.data());
            recompute();
          });
          unsubs.push(offFb);
        }
      );
      unsubs.push(off);
    }

    // ✅ Pair-first: when paired, only count pair-scoped docs (and the pair subcollection).
    if (pairId) {
      add(
        query(baseRef, where('pairId', '==', pairId), where('createdAt', '>=', sinceTs), orderBy('createdAt', 'desc')),
        query(baseRef, where('pairId', '==', pairId))
      );
      const offSub = onSnapshot(
        collection(db, 'pairs', pairId, 'points'),
        (snap) => {
          for (const d of snap.docs) buf.set(dedupeKey(d.data(), d.id), d.data());
          recompute();
        }
      );
      unsubs.push(offSub);
    } else {
      // Not paired: fall back to my owner-only docs
      add(
        query(baseRef, where('ownerId', '==', user.uid), where('createdAt', '>=', sinceTs), orderBy('createdAt', 'desc')),
        query(baseRef, where('ownerId', '==', user.uid))
      );
    }

    // Listen for immediate updates emitted by Challenges (same pair/week only)
    const offEvt = DeviceEventEmitter.addListener('lp.weekly.points', (payload: any) => {
      try {
        const wk = weekKeyUTC(new Date());
        if (pairId && payload?.pairId !== pairId) return;
        if (payload?.week !== wk) return;
        setWeeklyLive((prev) =>
          (typeof prev === 'number'
            ? Math.max(prev, Number(payload.points) || 0)
            : Number(payload.points) || 0)
        );
      } catch {}
    });
    unsubs.push(() => offEvt.remove());

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [user?.uid, pairId]);

  // ---- LIVE lifetime total (pair-first; positive-only)
  useEffect(() => {
    if (!user?.uid) {
      setTotalLive(null);
      return;
    }
    const baseRef = collection(db, 'points');
    const buf = new Map<string, any>();
    const recompute = () => {
      let sum = 0;
      for (const data of buf.values()) {
        const v = getPointValue(data);
        if (Number.isFinite(v) && v > 0) sum += v;
      }
      setTotalLive(sum);
    };

    const unsubs: Array<() => void> = [];
    function add(qRef: Query<DocumentData>) {
      const off = onSnapshot(
        qRef,
        (snap: QuerySnapshot<DocumentData>) => {
          for (const d of snap.docs) buf.set(dedupeKey(d.data(), d.id), d.data());
          recompute();
        },
        (_err: FirestoreError) => {}
      );
      unsubs.push(off);
    }

    if (pairId) {
      // ✅ Pair-first: only pair-scoped docs + optional pair mirror subcollection
      add(query(baseRef, where('pairId', '==', pairId)));
      const offSub = onSnapshot(
        collection(db, 'pairs', pairId, 'points'),
        (snap) => {
          for (const d of snap.docs) buf.set(dedupeKey(d.data(), d.id), d.data());
          recompute();
        }
      );
      unsubs.push(offSub);
    } else {
      // Not paired: fall back to my owner-only docs
      add(query(baseRef, where('ownerId', '==', user.uid)));
    }

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [user?.uid, pairId]);

  // ---- Mirror challenge completions into shared pair points
  useEffect(() => {
    if (!user?.uid) return;

    const sub = DeviceEventEmitter.addListener('lp.challenge.completed', async (payload: any) => {
      try {
        const pts = Number(payload?.points ?? payload?.value ?? payload?.score ?? 0);
        if (!pts) return;

        const chId = String(payload?.challengeId ?? payload?.id ?? payload?.slug ?? 'challenge');
        const key = String(payload?.idempotencyKey ?? `challenge:${pairId ?? 'solo'}:${user.uid}:${chId}`);

        const base = {
          idempotencyKey: key,
          value: pts,
          source: 'challenge',
          ownerId: user.uid,
          pairId: pairId ?? null,
          createdAt: serverTimestamp(),
        };

        await setDoc(doc(db, 'points', key), base, { merge: true });
        if (pairId) await setDoc(doc(db, 'pairs', pairId, 'points', key), base, { merge: true });
      } catch (e) {
        console.warn('[home] pair mirror write failed:', e);
      }
    });

    return () => sub.remove();
  }, [user?.uid, pairId]);

  // ---- Optimistic bump
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('lp.challenge.completed', (payload: any) => {
      const pts = Number(payload?.points ?? 0);
      if (!pts) return;
      const weeklyBaseline = (weeklyLive ?? weekly ?? 0);
      const totalBaseline = (totalLive ?? total ?? 0);
      setWeeklyOptimistic({ bump: pts, baseline: weeklyBaseline });
      setTotalOptimistic({ bump: pts, baseline: totalBaseline });
    });
    return () => sub.remove();
  }, [weekly, weeklyLive, total, totalLive]);

  // ---- Clear optimistic bumps
  useEffect(() => {
    if (weeklyOptimistic) {
      const live = (weeklyLive ?? weekly ?? 0);
      const target = weeklyOptimistic.baseline + weeklyOptimistic.bump;
      if (live >= target) setWeeklyOptimistic(null);
    }
  }, [weeklyLive, weekly, weeklyOptimistic]);
  useEffect(() => {
    if (totalOptimistic) {
      const live = (totalLive ?? total ?? 0);
      const target = totalOptimistic.baseline + totalOptimistic.bump;
      if (live >= target) setTotalOptimistic(null);
    }
  }, [totalLive, total, totalOptimistic]);

  // ---- Day ideas
  const [key, setKey] = useState<number>(() => dayKey());
  useEffect(() => {
    const now = new Date();
    const next = new Date(now);
    next.setHours(24, 0, 0, 0);
    const to = setTimeout(() => setKey(dayKey()), next.getTime() - now.getTime());
    return () => clearTimeout(to);
  }, [key]);

  const ideas = useMemo(() => {
    const off = offsetFromKey(key);
    const rot = [...IDEAS.slice(off), ...IDEAS.slice(0, off)];
    return rot.slice(0, 5);
  }, [key]);

  const onIdea = useCallback(
    (txt: string) => nav.navigate('Tasks', { presetIdea: txt }),
    [nav]
  );

  // ---- Effective UI numbers
  const weeklyBase = weeklyLive ?? weekly ?? 0;
  const weeklyDisplayRaw =
    weeklyOptimistic ? Math.max(weeklyBase, weeklyOptimistic.baseline + weeklyOptimistic.bump) : weeklyBase;
  const weeklyDisplay = Math.min(weeklyDisplayRaw, WEEK_GOAL);
  const totalBase = totalLive ?? (total ?? 0);
  const totalDisplay =
    totalOptimistic ? Math.max(totalBase, totalOptimistic.baseline + totalOptimistic.bump) : totalBase;

  // ---- Copy tweaks
  const weeklyLeft = Math.max(0, WEEK_GOAL - weeklyDisplay);
  const nudge =
    weeklyLeft === 0
      ? 'Weekly goal reached — you’re a dream team! 💞'
      : weeklyDisplay < WEEK_GOAL / 3
      ? 'Small steps count—one kind thing today?'
      : weeklyDisplay < (2 * WEEK_GOAL) / 3
      ? 'You’re halfway there—keep going 👏'
      : 'So close! A tiny push and you’re there ✨';

  const { target, remaining } = useMemo(
    () => nextMilestone(totalDisplay),
    [totalDisplay]
  );

  // ---- Add reward
  const onCreateReward = async (title: string, cost: number) => {
    if (!user) return;
    await addReward(user.uid, pairId ?? null, title, cost);
  };

  // ---- QR helpers
  const openPairingQR = useCallback(() => {
    const navRef: any = nav as any;
    const candidates = [
      'PairingShare',
      'PairingQR',
      'PairingShowQR',
      'PairingCode',
      'PairQr',
      'PairingInvite',
      'Pairing',
      'PairWithPartner',
    ];

    const canNavigateTo = (n: any, name: string) => {
      try {
        const state = n.getState?.();
        const names = new Set<string>();
        const walk = (s: any) => {
          if (!s) return;
          if (Array.isArray(s.routes)) {
            for (const r of s.routes) {
              if (r?.name) names.add(r.name);
              if (r?.state) walk(r.state);
            }
          }
        };
        walk(state);
        return names.has(name);
      } catch {
        return false;
      }
    };

    const navigators = [navRef, navRef.getParent?.()].filter(Boolean) as any[];

    for (const n of navigators) {
      for (const route of candidates) {
        if (canNavigateTo(n, route)) {
          try {
            n.navigate(route as never, { origin: 'Home' } as never);
            return;
          } catch {}
        }
      }
    }

    try {
      (navRef.getParent?.() ?? navRef).navigate('Settings', {
        screen: 'Pairing',
        params: { showQR: true, origin: 'Home' },
      });
      return;
    } catch {}

    Alert.alert('Pairing QR', 'Open Settings → Pairing to view your QR code.');
  }, [nav]);

  const onEnterCode = useCallback(() => {
    if (!user?.uid) return;
    if (isIOS && (Alert as any).prompt) {
      // @ts-ignore iOS-only
      Alert.prompt('Enter pairing code', 'Paste the code you received to link accounts.', async (code: string) => {
        if (!code) return;
        try {
          await redeemPairCode(user.uid, code.trim());
          Alert.alert('Linked', 'You are now linked 💞');
        } catch (e: any) {
          Alert.alert('Could not link', e?.message ?? 'Try again.');
        }
      });
      return;
    }
    setCodePromptVisible(true);
  }, [user?.uid]);

  const handleRedeemCode = useCallback(async () => {
    if (!user?.uid) return;
    const code = codeText.trim();
    if (!code) {
      Alert.alert('Enter code', 'Please paste the code.');
      return;
    }
    try {
      setCodeBusy(true);
      await redeemPairCode(user.uid, code);
      setCodePromptVisible(false);
      setCodeText('');
      Alert.alert('Linked', 'You are now linked 💞');
    } catch (e: any) {
      Alert.alert('Could not link', e?.message ?? 'Try again.');
    } finally {
      setCodeBusy(false);
    }
  }, [codeText, user?.uid]);

  const pairCardShouldShow =
    !!user &&
    (
      (pairReady && !pairId) ||
      (!pairReady && pairHint === 'unlinked')
    );

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => setInteractionsDone(true));
    return () => {
      // @ts-ignore
      task?.cancel?.();
    };
  }, []);

  // We don't measure the tab bar from here; it's targeted by id "tabbar" from AppNavigator.
  useEffect(() => {
    setNavReady(true);
  }, []);

  const FIRST_RUN_STEPS: SpotlightStep[] = useMemo(() => {
    const base: SpotlightStep[] = [
      {
        id: 'welcome',
        targetId: null,
        title: 'Welcome to LovePoints 💖',
        text: 'Quick tour to get you started?',
        placement: 'bottom',
        allowBackdropTapToNext: true,
      },
    ];

    if (pairCardShouldShow) {
      base.push({
        id: 'link',
        targetId: 'home-link-partner',
        title: 'Pair up',
        text: 'Link with your partner to sync points and memories.',
      });
    }

    base.push(
      { id: 'log',    targetId: 'home-log-task',   title: 'Log a task', text: 'Track a kind action and earn LovePoints.' },
      { id: 'reward', targetId: 'home-add-reward', title: 'Rewards',    text: 'Add a reward you can redeem with points.' },
      { id: 'ideas',  targetId: 'home-ideas-anchor', title: 'Ideas for today', text: 'Quick suggestions for easy wins.', placement: 'top', padding: 6 },
      { id: 'settings', targetId: 'home-settings', title: 'Settings', text: 'Manage your profile, pairing, and notifications.' },
      Platform.OS === 'ios'
        ? {
            id: 'nav',
            targetId: 'tabbar', // highlight the real iOS tab bar
            title: 'Navigation',
            text: 'Use the tabs below to move around: Home, Memories, Reminders, Love Notes, Tasks, Challenges.',
            placement: 'top',
            padding: 0,
            tooltipOffset: 10,
            allowBackdropTapToNext: true,
          }
        : {
            id: 'nav',
            targetId: null,
            title: 'Navigation',
            text: 'Use the tabs below to move around: Home, Memories, Reminders, Love Notes, Tasks, Challenges.',
            placement: 'bottom',
            padding: 0,
            allowBackdropTapToNext: true,
          }
    );

    return base;
  }, [pairCardShouldShow]);

  const spotlightReady =
    interactionsDone &&
    logReady &&
    rewardReady &&
    settingsReady &&
    (!pairCardShouldShow || linkReady) &&
    navReady;

  return (
    <Screen>
      {/* HERO */}
      <View style={{ marginTop: 6, marginBottom: 8 }}>
        <ThemedText variant="display" style={{ marginBottom: 8 }}>
          {greeting()} 👋
        </ThemedText>

        {/* Data pills (left) + Settings (right) */}
        <View style={s.metaRow}>
          <View style={s.pillGroup}>
            <Pill>
              <Ionicons name="flame" size={16} color={t.colors.textDim} />
              <ThemedText variant="label">Streak {streak?.current ?? 0}</ThemedText>
              <ThemedText variant="label" color={t.colors.textDim}>• Best {streak?.longest ?? 0}</ThemedText>
            </Pill>
            <Pill>
              <Ionicons name="trophy" size={16} color={t.colors.textDim} />
              <ThemedText variant="label">{totalDisplay}</ThemedText>
            </Pill>
          </View>

          <View
            collapsable={false}
            style={{ alignSelf: 'flex-start' }}
            onLayout={() => setSettingsReady(true)}
          >
            <SpotlightTarget id="home-settings">
              <Button label="Settings" variant="outline" onPress={() => nav.navigate('Settings')} />
            </SpotlightTarget>
          </View>
        </View>
      </View>

      {/* Partner action card */}
      {pairCardShouldShow && (
        <View collapsable={false} onLayout={() => setLinkReady(true)}>
          <SpotlightTarget id="home-link-partner">
            <Card style={{ marginBottom: 12, paddingVertical: 12, borderWidth: 1, borderColor: HAIRLINE }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: withAlpha(t.colors.primary, 0.08), alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="link" size={18} color={t.colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <ThemedText variant="title">Link with your partner</ThemedText>
                  <ThemedText variant="caption" color={t.colors.textDim}>Share points and memories together.</ThemedText>
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
                <Button
                  label="Scan QR"
                  onPress={() => {
                    try {
                      (nav as any).navigate('PairingScan');
                    } catch {
                      Alert.alert('Pairing', 'Scanner not available. Open Settings → Pairing.');
                    }
                  }}
                />
                <Button
                  label="Show my QR"
                  variant="outline"
                  onPress={openPairingQR}
                />
              </View>

              <Pressable
                onPress={onEnterCode}
                accessibilityRole="button"
                style={{ alignSelf: 'flex-start', marginTop: 8, paddingVertical: 6, paddingHorizontal: 8 }}
              >
                <ThemedText variant="caption" color={t.colors.primary}>Have a code? Enter it here</ThemedText>
              </Pressable>
            </Card>
          </SpotlightTarget>
        </View>
      )}

      {/* Weekly goal */}
      <Card style={{ marginBottom: 12, borderWidth: 1, borderColor: HAIRLINE }}>
        {/* Title row + optional right counter */}
        <View style={{ marginBottom: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <ThemedText variant="subtitle" style={{ flexShrink: 0 }}>Weekly goal</ThemedText>

            {weeklyLeft > 0 && (
              <ThemedText
                variant="caption"
                color={t.colors.textDim}
                style={{ marginLeft: 8, flexGrow: 1, textAlign: 'right' }}
                numberOfLines={1}
              >
                {weeklyDisplay} / {WEEK_GOAL} · {weeklyLeft} to go
              </ThemedText>
            )}
          </View>

          {weeklyLeft === 0 && (
            <ThemedText variant="caption" color={t.colors.textDim} style={{ marginTop: 4 }}>
              Weekly goal reached — you’re a dream team! 💞
            </ThemedText>
          )}
        </View>

        <ProgressBar value={weeklyDisplay} max={WEEK_GOAL} height={8} trackColor="#EDEAF1" />

        {weeklyLeft > 0 && (
          <ThemedText variant="caption" color={t.colors.textDim} style={{ marginTop: 8 }}>
            {nudge}
          </ThemedText>
        )}

        <View style={{ marginTop: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <ThemedText variant="label" color={t.colors.textDim}>Next milestone</ThemedText>
            <ThemedText variant="label">{target} pts</ThemedText>
          </View>
          <ProgressBar value={totalDisplay} max={target} height={6} trackColor="#EDEAF1" />
          <ThemedText variant="caption" color={t.colors.textDim} style={{ marginTop: 4 }}>
            {remaining} to go • {weeklyDisplay} this week
          </ThemedText>
        </View>

        <View style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center' }}>
          <View collapsable={false} style={{ alignSelf: 'flex-start' }} onLayout={() => setLogReady(true)}>
            <SpotlightTarget id="home-log-task">
              <Button label="Log a task" onPress={() => nav.navigate('Tasks')} />
            </SpotlightTarget>
          </View>
          <View style={{ width: 12 }} />
          <View collapsable={false} style={{ alignSelf: 'flex-start' }} onLayout={() => setRewardReady(true)}>
            <SpotlightTarget id="home-add-reward">
              <Button label="Add reward" variant="outline" onPress={() => setShowAddReward(true)} />
            </SpotlightTarget>
          </View>
        </View>
      </Card>

      {/* Ideas */}
      <Card style={{ marginBottom: 12, borderWidth: 1, borderColor: HAIRLINE }}>
        <SpotlightTarget id="home-ideas-anchor" style={{ alignSelf: 'stretch' }}>
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <ThemedText variant="subtitle" style={{ flex: 1 }}>Ideas for today</ThemedText>

              {/* Static label only — no navigation */}
              <View>
                <ThemedText variant="label" color={t.colors.primary}>See more →</ThemedText>
              </View>

              <View style={{ width: 12 }} />
              <Pressable onPress={() => setKey(k => k + 1)} accessibilityRole="button">
                <ThemedText variant="label" color={t.colors.primary}>🔀 Shuffle</ThemedText>
              </Pressable>
            </View>

            <View style={s.tagWrap}>
              {ideas.slice(0, 2).map(txt => (
                <Pressable key={txt} onPress={() => onIdea(txt)} style={s.chip} accessibilityRole="button">
                  <Ionicons name="sparkles" size={14} color={t.colors.textDim} />
                  <ThemedText variant="label" style={{ marginLeft: 6 }}>{txt}</ThemedText>
                </Pressable>
              ))}
            </View>
          </View>
        </SpotlightTarget>

        <View style={[s.tagWrap, { marginTop: 10 }]}>
          {ideas.slice(2).map(txt => (
            <Pressable key={txt} onPress={() => onIdea(txt)} style={s.chip} accessibilityRole="button">
              <Ionicons name="sparkles" size={14} color={t.colors.textDim} />
              <ThemedText variant="label" style={{ marginLeft: 6 }}>{txt}</ThemedText>
            </Pressable>
          ))}
        </View>
      </Card>

      {/* Bottom nudge */}
      <Card style={{ marginBottom: 16, borderWidth: 1, borderColor: HAIRLINE }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: withAlpha(t.colors.primary, 0.08), alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="sparkles" size={18} color={t.colors.primary} />
          </View>
          <ThemedText variant="title">Try a tiny challenge tonight</ThemedText>
        </View>
        <ThemedText variant="caption" color={t.colors.textDim}>A small step keeps your streak healthy. Explore a quick challenge.</ThemedText>
        <View style={{ marginTop: 10 }}>
          <Button label="Open Challenges" variant="outline" onPress={() => nav.navigate('Challenges')} />
        </View>
      </Card>

      {/* Add reward modal */}
      <RedeemModal visible={showAddReward} onClose={() => setShowAddReward(false)} onCreate={onCreateReward} />

      {/* CODE PROMPT */}
      <Modal
        visible={codePromptVisible}
        animationType="fade"
        transparent
        onRequestClose={() => !codeBusy && setCodePromptVisible(false)}
      >
        <View style={s.modalOverlay}>
          <Card style={s.modalCard}>
            <ThemedText variant="title" style={{ marginBottom: 8 }}>Enter pairing code</ThemedText>
            <ThemedText variant="caption" color={t.colors.textDim} style={{ marginBottom: 8 }}>
              Paste the code you received to link accounts.
            </ThemedText>

            <Input
              value={codeText}
              onChangeText={setCodeText}
              placeholder="Paste code…"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!codeBusy}
              returnKeyType="done"
              onSubmitEditing={handleRedeemCode}
            />

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
              <Button label="Cancel" variant="outline" onPress={() => setCodePromptVisible(false)} disabled={codeBusy} />
              <Button
                label={codeBusy ? 'Linking…' : 'Link'}
                onPress={handleRedeemCode}
                disabled={!codeText.trim() || codeBusy}
              />
            </View>
          </Card>
        </View>
      </Modal>

      {spotlightReady && (
        <SpotlightAutoStarter
          key={pairCardShouldShow ? 'with-link' : 'no-link'}
          uid={user?.uid ?? null}
          steps={FIRST_RUN_STEPS}
          persistKey="first-run-v3"
        />
      )}
    </Screen>
  );
}

const styles = (t: ThemeTokens) =>
  StyleSheet.create({
    headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
    pillGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, flexShrink: 1 },
    pillsRow: { flexDirection: 'row', gap: 12 },
    tagWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 999,
      backgroundColor: '#F3EEF6',
      borderWidth: 1,
      borderColor: '#F0E6EF',
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.35)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
    },
    modalCard: {
      width: '100%',
      borderWidth: 1,
      borderColor: HAIRLINE,
      padding: t.spacing.md,
      borderRadius: 16,
      backgroundColor: t.colors.bg,
    },
  });