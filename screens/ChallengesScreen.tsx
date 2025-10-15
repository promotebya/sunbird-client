// screens/ChallengesScreen.tsx
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  DeviceEventEmitter,
  Platform,
  Pressable,
  ScrollView,
  SectionList,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Button from '../components/Button';
import Card from '../components/Card';
import ThemedText from '../components/ThemedText';
import { useTokens, type ThemeTokens } from '../components/ThemeProvider';

import useAuthListener from '../hooks/useAuthListener';
import { usePlanPlus } from '../hooks/usePlan';
import {
  CHALLENGE_POOL,
  getWeeklyChallengeSet,
  type SeedChallenge,
} from '../utils/seedchallenges';
import { usePro } from '../utils/subscriptions';

// Firestore
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { getPairId } from '../utils/partner';

// Spotlight
import {
  SpotlightAutoStarter,
  SpotlightTarget,
  type SpotlightStep,
} from '../components/spotlight';

/* ---------- helpers, types & labels ---------- */

type DiffTabKey = 'all' | 'easy' | 'medium' | 'hard' | 'pro';
type DiffKey = 'easy' | 'medium' | 'hard' | 'pro';
type CatKey = 'date' | 'kindness' | 'conversation' | 'surprise' | 'play';

const ORDER: DiffKey[] = ['easy', 'medium', 'hard', 'pro'];

const TABS: { key: DiffTabKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'easy', label: 'Tender Moments (easy)' },
  { key: 'medium', label: 'Heart to Heart (medium)' },
  { key: 'hard', label: 'Passionate Quests (hard)' },
  { key: 'pro', label: 'Forever & Always (pro)' },
];

const DIFF_SIMPLE: Record<DiffKey, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
  pro: 'Pro',
};
const DIFF_LABEL: Record<DiffKey, string> = {
  easy: 'Tender Moments',
  medium: 'Heart to Heart',
  hard: 'Passionate Quests',
  pro: 'Forever & Always',
};
const CATEGORY_LABEL: Record<CatKey, string> = {
  date: 'Dates',
  kindness: 'Kindness',
  conversation: 'Talk',
  surprise: 'Surprise',
  play: 'Play',
};
const CAT_DOT: Record<CatKey, string> = {
  date: '#F59E0B',
  kindness: '#10B981',
  conversation: '#A78BFA',
  surprise: '#F97316',
  play: '#60A5FA',
};

function withAlpha(hex: string, alpha: number) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const a = Math.round(alpha * 255).toString(16).padStart(2, '0');
  return `#${full}${a}`;
}
function mixWithWhite(hex: string, ratio = 0.9) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const m = (c: number) => Math.round(c * (1 - ratio) + 255 * ratio);
  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${toHex(m(r))}${toHex(m(g))}${toHex(m(b))}`;
}

// ---------- Difficulty / category extraction ----------
function normDiff(raw: any): DiffKey | undefined {
  if (raw == null) return undefined;
  const n = Number(raw);
  if (Number.isFinite(n)) return (['easy', 'medium', 'hard', 'pro'][Math.max(0, Math.min(3, n))] as DiffKey);
  const v = String(raw).trim().toLowerCase();
  if (v.startsWith('e')) return 'easy';
  if (v.startsWith('m')) return 'medium';
  if (v.startsWith('h')) return 'hard';
  if (v.startsWith('p')) return 'pro';
  return undefined;
}
function extractDiffStrict(c: any): DiffKey | undefined {
  const tried = [c?.difficulty, c?.level, c?.diff, c?.difficultyLevel, c?.difficulty_label, c?.difficultyLabel, c?.d];
  for (const t of tried) {
    const k = normDiff(t);
    if (k) return k;
  }
  return undefined;
}
const extractTitleStrict = (c: any) =>
  c?.title ?? c?.name ?? c?.heading ?? c?.prompt ?? c?.text ?? undefined;
const extractDescriptionStrict = (c: any) =>
  c?.description ?? c?.summary ?? c?.body ?? c?.details ?? undefined;

type CatKeyMaybe = CatKey | undefined;
function extractCategoryStrict(c: any): CatKeyMaybe {
  const candidates: Array<string | string[]> = [
    c?.category, c?.cat, c?.type, c?.topic, c?.tag, c?.tags, c?.labels, c?.categories,
  ];
  const set: Record<string, CatKey> = {
    date: 'date', dates: 'date',
    kindness: 'kindness',
    talk: 'conversation', conversation: 'conversation', convo: 'conversation',
    surprise: 'surprise',
    play: 'play',
  };
  for (const cand of candidates) {
    if (Array.isArray(cand)) {
      for (const s of cand) {
        const key = set[String(s).trim().toLowerCase()];
        if (key) return key as CatKey;
      }
    } else if (cand != null) {
      const key = set[String(cand).trim().toLowerCase()];
      if (key) return key as CatKey;
    }
  }
  return undefined;
}

function cleanTitleSuffix(raw?: string): string {
  const title = (raw ?? '').trim();
  if (!title) return 'Challenge';
  const cats = ['date','dates','kindness','conversation','talk','surprise','play'];
  const re = new RegExp(`\\s*(?:${cats.join('|')})\\s*$`, 'i');
  return title.replace(re, '');
}
const safeTitle = (c: any) => cleanTitleSuffix(extractTitleStrict(c)) || 'Challenge';
const safeDescription = (c: any) => extractDescriptionStrict(c);
const safeCategory = (c: any) => extractCategoryStrict(c);

function rowKey(c: any, suffix: 'V' | 'L', index: number): string {
  const base = c?.id ?? c?.slug ?? `${safeTitle(c)}|${safeCategory(c) ?? 'na'}|${extractDiffStrict(c) ?? 'na'}`;
  return `${String(base)}__${suffix}_${index}`;
}
function mergePreferBase<T extends Record<string, any>>(base: T, patch: Partial<T>): T {
  const out: any = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    if (v == null) continue;
    if (typeof v === 'string' && v.trim() === '') continue;
    if (Array.isArray(v) && v.length === 0) continue;
    out[k] = v;
  }
  return out as T;
}

// ---------- Pair + premium helpers ----------
function lockMessage(
  plan: 'free' | 'premium',
  c: SeedChallenge,
  weeklyPts?: number
): string {
  const tierRaw = (c as any)?.tier as 'base' | '10' | '25' | '50' | number | undefined;
  const d = extractDiffStrict(c);

  const toNum = (tr: any): number | null => {
    if (typeof tr === 'number') return tr;
    if (tr === '10') return 10;
    if (tr === '25') return 25;
    if (tr === '50') return 50;
    return null;
  };

  const req = toNum(tierRaw);
  if (req != null) {
    const have = typeof weeklyPts === 'number' ? weeklyPts : 0;
    return have >= req ? 'Unlocked' : `Needs ${req}+ pts`;
  }

  if (plan === 'free' && d && d !== 'easy') return 'Premium required';
  return 'Locked';
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

// ---------- UTC week helpers ----------
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
function startOfWeekMondayUTC(d = new Date()) {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = (date.getUTCDay() + 6) % 7; // 0=Mon
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - day);
  return date;
}

/* ---------- screen ---------- */

export default function ChallengesScreen() {
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const t = useTokens();
  const s = useMemo(() => styles(t), [t]);

  const { user } = useAuthListener();
  const { isPremium } = usePlanPlus(user?.uid);
  const { hasPro } = usePro();

  // Pair state
  const [partnerUid, setPartnerUid] = useState<string | null>(null);
  const [pairId, setPairId] = useState<string | null>(null);
  const [pairPremiumActive, setPairPremiumActive] = useState<boolean>(false);
  const [pairLoaded, setPairLoaded] = useState<boolean>(false);
  // NEW: pair-level lifetime total aggregate read from pairs doc
  const [pairTotalAgg, setPairTotalAgg] = useState<number | null>(null);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    (async () => {
      try {
        setPairLoaded(false);
        if (!user?.uid) {
          setPartnerUid(null);
          setPairId(null);
          setPairLoaded(true);
          return;
        }
        const pid = await getPairId(user.uid);
        setPairId(pid ?? null);
        if (!pid) {
          setPartnerUid(null);
          setPairLoaded(true);
          return;
        }
        const ref = doc(db, 'pairs', pid);
        unsubscribe = onSnapshot(
          ref,
          (snap) => {
            setPairLoaded(true);
            if (!snap.exists()) {
              setPartnerUid(null);
              setPairPremiumActive(false);
              setPairId(null);
              setPairTotalAgg(null);
              return;
            }
            const data = snap.data();
            const other = extractPartnerUidFromPairDoc(data, user.uid);
            setPartnerUid(other ?? null);
            const pairHasPremium = !!(
              data?.premiumActive ?? data?.premium ?? data?.proActive ?? data?.plusActive ?? data?.premiumForPair
            );
            setPairPremiumActive(pairHasPremium);
            // NEW: read pair-level total aggregate if present
            const tot = Number((data as any)?.totalPoints);
            setPairTotalAgg(Number.isFinite(tot) ? tot : null);
          },
          () => {
            setPairLoaded(true);
            setPartnerUid(null);
            setPairPremiumActive(false);
            setPairId(null);
            setPairTotalAgg(null);
          }
        );
      } catch {
        setPairLoaded(true);
        setPartnerUid(null);
        setPairId(null);
      }
    })();
    return () => { if (unsubscribe) unsubscribe(); };
  }, [user?.uid]);

  const { isPremium: partnerIsPremium } = usePlanPlus(partnerUid ?? undefined);

  // Propagate premium to pair doc
  useEffect(() => {
    (async () => {
      try {
        if (!pairId) return;
        const localHasPremium = !!(isPremium || hasPro);
        if (!localHasPremium || pairPremiumActive) return;
        await updateDoc(doc(db, 'pairs', pairId), {
          premiumActive: true,
          premiumUpdatedAt: serverTimestamp(),
          premiumUpdatedBy: user?.uid ?? null,
        });
      } catch {}
    })();
  }, [pairId, isPremium, hasPro, pairPremiumActive, user?.uid]);

  // Shared seed
  const weeklySeed = useMemo(() => {
    const week = weekKeyUTC(new Date());
    if (!pairLoaded) return `pending:${week}`;
    if (pairId) return `pair:${pairId}:${week}`;
    return `solo:${user?.uid ?? 'guest'}:${week}`;
  }, [pairId, user?.uid, pairLoaded]);

  // ----- POINTS NORMALIZER (works across different schemas) -----
  const getPointValue = (data: any): number => {
    const candidates = [data?.value, data?.points, data?.point, data?.amount, data?.delta, data?.score];
    for (const c of candidates) {
      const n = Number(c);
      if (Number.isFinite(n)) return n;
    }
    return 0;
  };

  // ---- WEEKLY TOTAL (UNION: pairId + both owners) — Monday 00:00 UTC window
  const [weeklyUnionLive, setWeeklyUnionLive] = useState<number | null>(null);

  // Timestamp normalizer
  const getPointDate = (data: any): Date | null => {
    const when: any = data?.createdAt ?? data?.timestamp ?? data?.ts ?? data?.time;
    if (!when) return null;
    try {
      if (typeof when?.toDate === 'function') return when.toDate();
      const n = Number(when);
      if (Number.isFinite(n)) return new Date(n);
      const iso = new Date(String(when));
      return Number.isFinite(iso.getTime()) ? iso : null;
    } catch {
      return null;
    }
  };

  useEffect(() => {
    if (!user?.uid) { setWeeklyUnionLive(null); return; }

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
        const dt = getPointDate(data);
        if (dt && dt >= since && dt < until && Number.isFinite(v) && v > 0) sum += v;
      }
      setWeeklyUnionLive(sum);
    };

    const unsubs: Array<() => void> = [];

    const add = (qRef: any, fbRef?: any) =>
      onSnapshot(
        qRef,
        (snap: any) => {
          for (const d of snap.docs) buf.set(d.id, d.data());
          recompute();
        },
        () => {
          if (!fbRef) return;
          const off = onSnapshot(fbRef, (snap2: any) => {
            for (const d of snap2.docs) buf.set(d.id, d.data());
            recompute();
          });
          unsubs.push(off);
        }
      );

    // mine (ownerId)
    unsubs.push(
      add(
        query(baseRef, where('ownerId', '==', user.uid), where('createdAt', '>=', sinceTs), orderBy('createdAt', 'desc')),
        query(baseRef, where('ownerId', '==', user.uid))
      )
    );

    // shared pair docs
    if (pairId) {
      unsubs.push(
        add(
          query(baseRef, where('pairId', '==', pairId), where('createdAt', '>=', sinceTs), orderBy('createdAt', 'desc')),
          query(baseRef, where('pairId', '==', pairId))
        )
      );
    }

    // partner legacy owner-only
    if (partnerUid) {
      unsubs.push(
        add(
          query(baseRef, where('ownerId', '==', partnerUid), where('createdAt', '>=', sinceTs), orderBy('createdAt', 'desc')),
          query(baseRef, where('ownerId', '==', partnerUid))
        )
      );
    }

    return () => { unsubs.forEach((u) => u()); };
  }, [user?.uid, pairId, partnerUid]);

  // Effective for generator (union weekly across pair + both owners)
  const weeklyForSelection = weeklyUnionLive ?? 0;

  // Premium plan resolution
  const effectivePremium = !!(isPremium || hasPro || partnerIsPremium || pairPremiumActive);
  const safePlan: 'free' | 'premium' = effectivePremium ? 'premium' : 'free';

  const [tab, setTab] = useState<DiffTabKey>('all');

  // Build weekly set
  const selection = useMemo(
    () =>
      getWeeklyChallengeSet({
        plan: safePlan,
        weeklyPoints: weeklyForSelection,
        uid: weeklySeed,
        pool: CHALLENGE_POOL,
      }),
    [safePlan, weeklyForSelection, weeklySeed]
  );

  // Pool map for merging
  const POOL_BY_ID = useMemo(() => {
    const m = new Map<string, any>();
    for (const p of CHALLENGE_POOL) {
      const id = (p as any)?.id;
      if (id != null) m.set(String(id), p);
    }
    return m;
  }, []);

  // Fallback if pool/selection is empty
  const selectionSafe = useMemo(() => {
    const totalCount = selection.visible.length + selection.locked.length;
    if (totalCount > 0) return selection;
    const anyEasy = CHALLENGE_POOL.find((c) => extractDiffStrict(c) === 'easy');
    const anyHard = CHALLENGE_POOL.find((c) => extractDiffStrict(c) === 'hard');
    const vis: SeedChallenge[] = [];
    const lock: SeedChallenge[] = [];
    if (anyEasy) vis.push({ ...(anyEasy as SeedChallenge), tier: 'base' as const });
    if (anyHard) {
      if (safePlan === 'free') lock.push({ ...(anyHard as SeedChallenge), tier: '25' as const });
      else vis.push({ ...(anyHard as SeedChallenge), tier: 'base' as const });
    }
    return { visible: vis, locked: lock };
  }, [selection, safePlan]);

  // ---- TOTAL POINTS (pair + owner fallbacks, de-duped) + optimistic bump ----
  const [totalLive, setTotalLive] = useState<number | null>(null);

  useEffect(() => {
    if (!pairId && !user?.uid) { setTotalLive(null); return; }
    const master = new Map<string, number>();
    const apply = () => {
      let sum = 0;
      for (const v of master.values()) sum += Number(v) || 0;
      setTotalLive(Math.max(0, sum));
    };

    const unsubs: Array<() => void> = [];

    if (pairId) {
      unsubs.push(onSnapshot(
        query(collection(db, 'points'), where('pairId', '==', pairId)),
        (snap) => {
          for (const d of snap.docs) {
            master.set(d.id, getPointValue(d.data()));
          }
          apply();
        }
      ));

      try {
        unsubs.push(onSnapshot(
          collection(db, 'pairs', pairId, 'points'),
          (snap) => {
            for (const d of snap.docs) {
              master.set(`sub:${d.id}`, getPointValue(d.data()));
            }
            apply();
          }
        ));
      } catch {}
    }

    if (user?.uid) {
      unsubs.push(onSnapshot(
        query(collection(db, 'points'), where('ownerId', '==', user.uid)),
        (snap) => {
          for (const d of snap.docs) {
            master.set(d.id, getPointValue(d.data()));
          }
          apply();
        }
      ));
    }
    if (partnerUid) {
      unsubs.push(onSnapshot(
        query(collection(db, 'points'), where('ownerId', '==', partnerUid)),
        (snap) => {
          for (const d of snap.docs) {
            master.set(d.id, getPointValue(d.data()));
          }
          apply();
        }
      ));
    }

    return () => { for (const u of unsubs) try { u(); } catch {} };
  }, [pairId, user?.uid, partnerUid]);

  // Optimistic bump when a challenge completes (TOTAL)
  const [totalOptimistic, setTotalOptimistic] = useState<{ bump: number; baseline: number } | null>(null);
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('lp.challenge.completed', (payload: any) => {
      const pts = Number(payload?.points ?? payload?.value ?? 0);
      if (!pts) return;
      const baseline = (totalLive ?? 0);
      setTotalOptimistic({ bump: pts, baseline });
    });
    return () => sub.remove();
  }, [totalLive]);

  useEffect(() => {
    if (!totalOptimistic) return;
    const live = totalLive ?? 0;
    const target = totalOptimistic.baseline + totalOptimistic.bump;
    if (live >= target) setTotalOptimistic(null);
  }, [totalLive, totalOptimistic]);

  const totalDisplay =
    Math.max(0, totalOptimistic
      ? Math.max(totalLive ?? 0, totalOptimistic.baseline + totalOptimistic.bump)
      : (totalLive ?? 0));

  // NEW: coalesce with pair aggregate so both partners always see the same number
  const totalDisplaySynced = Math.max(totalDisplay, pairTotalAgg ?? 0);

  // NEW: persist + broadcast lifetime total for the pair (de-duped)
  const lastTotalWriteRef = useRef<string | null>(null);
  useEffect(() => {
    if (!pairId) return;
    const val = totalDisplay; // write computed union; both devices compute the same
    const key = `${pairId}:${val}`;
    if (lastTotalWriteRef.current === key) return;
    lastTotalWriteRef.current = key;

    (async () => {
      try {
        DeviceEventEmitter.emit('lp.total.points', { pairId, total: val });
      } catch {}

      try {
        await updateDoc(doc(db, 'pairs', pairId), {
          totalPoints: val,
          totalPointsUpdatedAt: serverTimestamp(),
        });
      } catch {}

      try {
        await setDoc(
          doc(db, 'pairs', pairId, 'totals', 'lifetime'),
          { total: val, updatedAt: serverTimestamp() },
          { merge: true }
        );
      } catch {}
    })();
  }, [pairId, totalDisplay]);

  // ---- Optimistic WEEKLY + broadcast + persist for Home ----
  const [weeklyOptimistic, setWeeklyOptimistic] = useState<{ bump: number; baseline: number } | null>(null);

  // Listen for completion to bump weekly optimistically too
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('lp.challenge.completed', (payload: any) => {
      const pts = Number(payload?.points ?? payload?.value ?? 0);
      if (!pts) return;
      setWeeklyOptimistic({ bump: pts, baseline: weeklyUnionLive ?? 0 });
    });
    return () => sub.remove();
  }, [weeklyUnionLive]);

  // Clear weekly optimistic when Firestore catches up
  useEffect(() => {
    if (!weeklyOptimistic) return;
    const live = weeklyUnionLive ?? 0;
    const target = weeklyOptimistic.baseline + weeklyOptimistic.bump;
    if (live >= target) setWeeklyOptimistic(null);
  }, [weeklyUnionLive, weeklyOptimistic]);

  const weeklyDisplay =
    Math.max(0, weeklyOptimistic
      ? Math.max(weeklyUnionLive ?? 0, weeklyOptimistic.baseline + weeklyOptimistic.bump)
      : (weeklyUnionLive ?? 0));

  // Emit and persist weekly value for Home screen
  const lastWriteRef = useRef<string | null>(null);
  useEffect(() => {
    if (!pairId) return;
    const wk = weekKeyUTC(new Date());
    const val = weeklyDisplay;

    // Broadcast an app-wide event for Home (and any other listeners)
    try {
      DeviceEventEmitter.emit('lp.weekly.points', { pairId, week: wk, points: val });
    } catch {}

    // Persist to pair doc + weekly subdoc (avoid redundant writes)
    const key = `${pairId}:${wk}:${val}`;
    if (lastWriteRef.current === key) return;
    lastWriteRef.current = key;

    (async () => {
      try {
        await updateDoc(doc(db, 'pairs', pairId), {
          weeklyPoints: val,
          weeklyPointsWeek: wk,
          weeklyPointsUpdatedAt: serverTimestamp(),
        });
      } catch {}
      try {
        await setDoc(
          doc(db, 'pairs', pairId, 'weekly', wk),
          { points: val, weekKey: wk, updatedAt: serverTimestamp() },
          { merge: true }
        );
      } catch {}
    })();
  }, [pairId, weeklyDisplay]);

  /* ---------- rows & sections ---------- */

  type Row = { id: string; c: SeedChallenge; locked: boolean };

  const allRows = useMemo<Row[]>(() => {
    const decorate = (c: SeedChallenge) => {
      const id = (c as any)?.id;
      const base = id != null ? POOL_BY_ID.get(String(id)) : undefined;
      if (!base) return c;

      const merged = mergePreferBase(base, c as any);
      (merged as any).difficulty  = extractDiffStrict(c) ?? extractDiffStrict(base);
      (merged as any).title       = extractTitleStrict(c) ?? extractTitleStrict(base);
      (merged as any).description = extractDescriptionStrict(c) ?? extractDescriptionStrict(base);
      (merged as any).category    = extractCategoryStrict(c) ?? extractCategoryStrict(base);
      return merged as SeedChallenge;
    };

    const vis: Row[] = selectionSafe.visible.map((c, i) => {
      const merged = decorate(c);
      return { id: rowKey(merged, 'V', i), c: merged, locked: false };
    });
    const lock: Row[] = selectionSafe.locked.map((c, i) => {
      const merged = decorate(c);
      return { id: rowKey(merged, 'L', i), c: merged, locked: true };
    });

    return [...vis, ...lock];
  }, [selectionSafe.visible, selectionSafe.locked, POOL_BY_ID]);

  const rowsByDiff = useMemo<Record<DiffKey, Row[]>>(() => {
    const acc: Record<DiffKey, Row[]> = { easy: [], medium: [], hard: [], pro: [] };
    for (const r of allRows) {
      const d = extractDiffStrict(r.c) ?? 'easy';
      acc[d].push(r);
    }
    return acc;
  }, [allRows]);

  const sections = useMemo(() => {
    const wanted = tab === 'all' ? ORDER : ([tab] as DiffKey[]);
    return wanted
      .map((d) => ({
        key: `sec_${d}`,
        title: `${DIFF_SIMPLE[d]} — ${DIFF_LABEL[d]}`,
        data: rowsByDiff[d],
      }))
      .filter((sec) => sec.data.length > 0);
  }, [rowsByDiff, tab]);

  const firstLockedKey = useMemo(() => {
    const toNum = (tr: any): number | null =>
      typeof tr === 'number' ? tr : tr === '10' ? 10 : tr === '25' ? 25 : tr === '50' ? 50 : null;

    for (const sec of sections) {
      for (const row of sec.data) {
        const dKey = extractDiffStrict(row.c) ?? 'easy';
        const tier = (row.c as any)?.tier as 'base' | '10' | '25' | '50' | number | undefined;
        const req = toNum(tier);
        const unlocksByPoints = req != null;
        const pointsLock = unlocksByPoints && weeklyForSelection < (req as number);
        const premiumLock = safePlan === 'free' && !unlocksByPoints && dKey !== 'easy';
        const finalLocked = premiumLock || pointsLock;
        if (finalLocked) return row.id;
      }
    }
    return null as string | null;
  }, [sections, safePlan, weeklyForSelection]);

  const visibleByCat = useMemo(() => {
    const m: Record<CatKey, number> = { date: 0, kindness: 0, conversation: 0, surprise: 0, play: 0 };
    for (const r of allRows) {
      if (!r.locked) {
        const k = safeCategory(r.c);
        if (k) m[k] += 1;
      }
    }
    return m;
  }, [allRows]);

  // Tutorial steps (Spotlight)
  const tourSteps = useMemo<SpotlightStep[]>(() => {
    const steps: SpotlightStep[] = [
      { id: 'ch-welcome', targetId: null, title: 'Weekly challenges ✨', text: 'Unlock fun things to do together. Quick tour?', placement: 'bottom', allowBackdropTapToNext: true },
      { id: 'ch-points-step', targetId: 'ch-points', title: 'Your points', text: 'Earn points by completing challenges. Points can unlock more.', placement: 'bottom', padding: 10 },
      { id: 'ch-tabs-step', targetId: 'ch-tabs', title: 'Browse by vibe', text: 'Filter by difficulty to match your mood.', placement: 'bottom', padding: 10 },
      { id: 'ch-legend-step', targetId: 'ch-legend', title: 'Categories', text: 'See how many challenges are in each category.', placement: 'bottom', padding: 10 },
    ];
    if (sections.length > 0) {
      steps.push({ id: 'ch-start-step', targetId: 'ch-start', title: 'Start here', text: 'Open a challenge, then mark it complete for points!', placement: 'top', padding: 12 });
    }
    if (firstLockedKey) {
      steps.push({ id: 'ch-lock-step', targetId: 'ch-lock', title: 'Locked items', text: 'Some unlock with points or Premium.', placement: 'top', padding: 12 });
    }
    return steps;
  }, [sections.length, firstLockedKey, effectivePremium]);

  /* ---------- navigation ---------- */

  const navRef = useNavigation<any>();
  const openChallenge = useCallback(
    (seed: SeedChallenge) => {
      const params = {
        challengeId: (seed as any)?.id,
        seed,
        completionChannel: 'lp.challenge.completed' as const,
      };
      const targets = ['ChallengeDetail', 'ChallengeDetailScreen', 'Challenge', 'ChallengeDetails'];
      const navigators = [navRef, navRef.getParent?.()].filter(Boolean) as any[];

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

      for (const n of navigators) {
        for (const route of targets) {
          if (canNavigateTo(n, route)) {
            try {
              n.navigate(route as never, params as never);
              return;
            } catch {}
          }
        }
      }

      try {
        (navRef.getParent?.() ?? navRef).navigate('ChallengeDetail', params as never);
      } catch (e) {
        console.warn('ChallengeDetail route not found.', e);
        Alert.alert('Challenge', 'Opening the challenge requires a "ChallengeDetail" screen in your navigator.');
      }
    },
    [navRef]
  );

  /* ---------- header / footer ---------- */

  const Header = (
    <View style={s.header}>
      <ThemedText variant="display">Challenges</ThemedText>

      <SpotlightTarget id="ch-points">
        <ThemedText variant="subtitle" color="textDim">
          Total points: {totalDisplaySynced}
        </ThemedText>
      </SpotlightTarget>

      <SpotlightTarget id="ch-tabs">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
          {TABS.map((tabDef) => {
            const active = tabDef.key === tab;
            return (
              <Pressable
                key={tabDef.key}
                onPress={() => setTab(tabDef.key)}
                style={[s.chip, active && { backgroundColor: t.colors.primary, borderColor: t.colors.primary }]}
                accessibilityRole="button"
              >
                <ThemedText variant="caption" color={active ? '#fff' : t.colors.textDim}>
                  {tabDef.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </ScrollView>
      </SpotlightTarget>

      <SpotlightTarget id="ch-legend">
        <View style={s.legendRow} accessibilityRole="text">
          {(['date','kindness','conversation','surprise','play'] as CatKey[]).map((k) => (
            <View key={k} style={s.legendItem}>
              <View style={[s.legendDot, { backgroundColor: CAT_DOT[k] }]} />
              <ThemedText variant="caption" color="textDim">
                {CATEGORY_LABEL[k]} {visibleByCat[k] ? `· ${visibleByCat[k]}` : ''}
              </ThemedText>
            </View>
          ))}
        </View>
      </SpotlightTarget>
    </View>
  );

  const UpsellFooter = !effectivePremium ? (
    <Card style={[s.upsellCard, { marginTop: t.spacing.lg, marginBottom: insets.bottom + 8 }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
        <View style={s.upsellBadge}>
          <Ionicons name="sparkles" size={18} color="#fff" />
        </View>
        <ThemedText variant="title" style={{ marginLeft: 10, paddingRight: 12, flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0 }}>
          Bring your relationship to the next level
        </ThemedText>
      </View>
      <ThemedText variant="body" color="textDim">
        Go Premium to turn date night into a weekly adventure. Fresh, expert-curated
        challenges you’ll actually look forward to.
      </ThemedText>
      <View style={{ marginTop: 12 }}>
        {[
          'Unlock 12 curated challenges every week',
          'New every week — always fun, romantic or surprising',
          'Explore 200+ romantic, playful & competitive challenges',
          'One subscription covers both partners',
        ].map((line) => (
          <View key={line} style={s.bulletRow}>
            <Ionicons name="checkmark-circle" size={16} color={t.colors.primary} style={s.bulletIcon} />
            <ThemedText variant="body" style={s.bulletText}>{line}</ThemedText>
          </View>
        ))}
      </View>
      <ThemedText variant="caption" color="textDim" style={{ marginTop: 12 }}>
        Upgrade now and instantly unlock +5 more challenges today.
      </ThemedText>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
        <Ionicons name="lock-closed" size={14} color="#6B7280" />
        <ThemedText variant="caption" color="textDim" style={{ marginLeft: 6 }}>
          First look: Urban Photo Essay (date)
        </ThemedText>
      </View>
      <SpotlightTarget id="ch-upsell">
        <Pressable
          onPress={() => {
            try { (nav.getParent?.() ?? nav).navigate('Paywall', { plan: 'monthly' }); }
            catch { Alert.alert('Premium', 'Purchases are coming soon ✨'); }
          }}
          accessibilityRole="button"
          style={s.tryPremiumBtn}
        >
          <ThemedText variant="button" color="#fff">Try Premium</ThemedText>
        </Pressable>
      </SpotlightTarget>
    </Card>
  ) : null;

  /* ---------- render ---------- */

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: t.colors.bg,
        paddingTop: insets.top + t.spacing.md,
        paddingBottom: 0,
        paddingHorizontal: t.spacing.lg,
      }}
    >
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={Header}
        ListFooterComponent={!effectivePremium ? UpsellFooter : null}
        renderSectionHeader={({ section }) => (
          <View style={s.sectionHeader}>
            <ThemedText variant="h2">{section.title}</ThemedText>
          </View>
        )}
        ItemSeparatorComponent={() => <View style={{ height: t.spacing.s }} />}
        SectionSeparatorComponent={() => <View style={{ height: t.spacing.s }} />}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + t.spacing.xl }}
        showsVerticalScrollIndicator={false}
        renderItem={({ item, index, section }) => {
          const c: any = item.c;
          const dKey = extractDiffStrict(c) ?? 'easy';
          const diffLabel = DIFF_LABEL[dKey];
          const catKey = safeCategory(c);
          const title = safeTitle(c);
          const desc = safeDescription(c);

          const toNum = (tr: any): number | null =>
            typeof tr === 'number' ? tr : tr === '10' ? 10 : tr === '25' ? 25 : tr === '50' ? 50 : null;
          const tier = (c as any)?.tier as 'base' | '10' | '25' | '50' | number | undefined;
          const req = toNum(tier);
          const unlocksByPoints = req != null;
          const pointsLock = unlocksByPoints && weeklyForSelection < (req as number);
          const premiumLock = safePlan === 'free' && !unlocksByPoints && dKey !== 'easy';
          const finalLocked = premiumLock || pointsLock;
          const isFirstLocked = item.id === firstLockedKey;

          const isFirstCard =
            sections.length > 0 && section?.key === sections[0]?.key && index === 0;

          return (
            <Card style={s.card}>
              <View style={s.row}>
                <View style={s.iconBubble}>
                  <Ionicons name="sparkles" size={18} color={t.colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <ThemedText variant="title">{title}</ThemedText>

                  {!finalLocked ? (
                    <>
                      {!!desc && <Clamp text={desc!} lines={4} dimColor={t.colors.textDim} />}

                      <View style={s.metaRow}>
                        {!!catKey && (
                          <View style={s.metaPill}>
                            <ThemedText variant="caption" color="textDim">
                              {CATEGORY_LABEL[catKey]}
                            </ThemedText>
                          </View>
                        )}
                        <View style={[s.metaPill, s.levelPill]}>
                          <ThemedText variant="caption" color={t.colors.primary}>
                            {diffLabel}
                          </ThemedText>
                        </View>
                        {typeof c?.points === 'number' && (
                          <ThemedText variant="caption" color="textDim">
                            {` • +${c.points} pts`}
                          </ThemedText>
                        )}
                      </View>

                      {isFirstCard ? (
                        <SpotlightTarget id="ch-start">
                          <Button
                            label="Start challenge"
                            onPress={() => openChallenge(c as SeedChallenge)}
                            style={{ marginTop: t.spacing.md }}
                          />
                        </SpotlightTarget>
                      ) : (
                        <Button
                          label="Start challenge"
                          onPress={() => openChallenge(c as SeedChallenge)}
                          style={{ marginTop: t.spacing.md }}
                        />
                      )}
                    </>
                  ) : (
                    <View style={{ marginTop: t.spacing.s }}>
                      {isFirstLocked ? (
                        <SpotlightTarget id="ch-lock">
                          <Pressable
                            onPress={() => {
                              const msg = lockMessage(safePlan, c, weeklyDisplay);
                              if (msg.includes('Premium')) {
                                try { (nav.getParent?.() ?? nav).navigate('Paywall', { plan: 'monthly' }); }
                                catch { Alert.alert('Premium', 'Purchases are coming soon ✨'); }
                              }
                            }}
                            style={s.lockBtn}
                            accessibilityRole="button"
                          >
                            <Ionicons name="lock-closed" size={16} color={t.colors.textDim} />
                            <ThemedText variant="label" color="textDim" style={{ marginLeft: 8 }}>
                              {lockMessage(safePlan, c, weeklyDisplay)}
                            </ThemedText>
                          </Pressable>
                        </SpotlightTarget>
                      ) : (
                        <Pressable
                          onPress={() => {
                            const msg = lockMessage(safePlan, c, weeklyDisplay);
                            if (msg.includes('Premium')) {
                              try { (nav.getParent?.() ?? nav).navigate('Paywall', { plan: 'monthly' }); }
                              catch { Alert.alert('Premium', 'Purchases are coming soon ✨'); }
                            }
                          }}
                          style={s.lockBtn}
                          accessibilityRole="button"
                        >
                          <Ionicons name="lock-closed" size={16} color={t.colors.textDim} />
                          <ThemedText variant="label" color="textDim" style={{ marginLeft: 8 }}>
                            {lockMessage(safePlan, c, weeklyDisplay)}
                          </ThemedText>
                        </Pressable>
                      )}
                    </View>
                  )}
                </View>
              </View>
            </Card>
          );
        }}
        ListEmptyComponent={
          <Card style={{ marginTop: t.spacing.md }}>
            <ThemedText variant="title">No challenges here yet</ThemedText>
            <ThemedText variant="caption" color="textDim">
              Try another tab or come back later.
            </ThemedText>
          </Card>
        }
      />

      {effectivePremium ? (
        <View style={[s.premiumBanner, { bottom: insets.bottom + 10 }]}>
          <Ionicons name="sparkles" size={14} color="#fff" />
          <ThemedText variant="label" color="#fff" style={{ marginLeft: 6 }}>
            You’re Premium
          </ThemedText>
        </View>
      ) : null}

      <SpotlightAutoStarter uid={user?.uid ?? null} steps={tourSteps} persistKey="tour-challenges-v4" />
    </View>
  );
}

/* ---------- Clamp (collapsible long text) ---------- */
function Clamp({
  text,
  lines = 4,
  dimColor,
}: { text: string; lines?: number; dimColor: string }) {
  const [expanded, setExpanded] = useState(false);
  const [showToggle, setShowToggle] = useState<boolean>(text.length > 140);
  return (
    <View>
      <ThemedText
        variant="body"
        color={dimColor}
        style={{ marginTop: 4 }}
        numberOfLines={expanded ? undefined : lines}
        onTextLayout={(e) => {
          const n = e?.nativeEvent?.lines?.length ?? 0;
          if (n > lines) setShowToggle(true);
        }}
        ellipsizeMode="tail"
      >
        {text}
      </ThemedText>
      {showToggle && (
        <Pressable onPress={() => setExpanded((v) => !v)} accessibilityRole="button" style={{ marginTop: 6 }}>
          <ThemedText variant="label" color={dimColor}>{expanded ? 'Show less' : 'Read more'}</ThemedText>
        </Pressable>
      )}
    </View>
  );
}

/* ---------- styles ---------- */
const styles = (t: ThemeTokens) =>
  StyleSheet.create({
    header: { paddingBottom: t.spacing.s },
    chips: { flexDirection: 'row', alignItems: 'center', marginTop: t.spacing.s, paddingVertical: 4 },
    chip: {
      marginRight: 8,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: t.radius.pill,
      borderWidth: 1,
      borderColor: t.colors.border,
      backgroundColor: t.colors.card,
    },
    legendRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: t.spacing.s },
    legendItem: { flexDirection: 'row', alignItems: 'center', marginRight: 12, marginBottom: 6 },
    legendDot: { width: 8, height: 8, borderRadius: 999, marginRight: 6 },
    sectionHeader: { marginTop: t.spacing.md, marginBottom: t.spacing.xs },
    card: { marginTop: t.spacing.s },
    row: { flexDirection: 'row' },
    iconBubble: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: withAlpha(t.colors.primary, 0.12),
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 8,
    },
    metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, flexWrap: 'wrap' },
    metaPill: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: t.radius.pill,
      marginRight: 6,
      backgroundColor: t.colors.card,
      borderWidth: 1,
      borderColor: t.colors.border,
    },
    levelPill: { backgroundColor: withAlpha(t.colors.primary, 0.08), borderColor: withAlpha(t.colors.primary, 0.18) },
    lockBtn: {
      alignSelf: 'flex-start',
      borderRadius: t.radius.pill,
      paddingVertical: 8,
      paddingHorizontal: t.spacing.md,
      backgroundColor: t.colors.card,
      borderWidth: 1,
      borderColor: t.colors.border,
      flexDirection: 'row',
      alignItems: 'center',
    },
    /* Upsell */
    upsellCard: {
      backgroundColor: Platform.OS === 'android' ? mixWithWhite(t.colors.primary, 0.9) : withAlpha(t.colors.primary, 0.08),
      borderColor: Platform.OS === 'android' ? mixWithWhite(t.colors.primary, 0.9) : withAlpha(t.colors.primary, 0.18),
      borderWidth: Platform.OS === 'android' ? StyleSheet.hairlineWidth : 1,
      overflow: 'hidden',
      ...(Platform.OS === 'android' ? { elevation: 0 } : {}),
    },
    upsellBadge: {
      width: 32,
      height: 32,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.colors.primary,
    },
    bulletRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 10 },
    bulletIcon: { marginTop: 3 },
    bulletText: { marginLeft: 8, lineHeight: 22, textAlign: 'left', flex: 1 },
    tryPremiumBtn: {
      marginTop: 12,
      alignSelf: 'stretch',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      borderRadius: t.radius.lg,
      backgroundColor: t.colors.primary,
    },
    premiumBanner: {
      position: 'absolute',
      alignSelf: 'center',
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: '#10B981',
      shadowColor: 'rgba(0,0,0,0.15)',
      shadowOpacity: 1,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 3 },
      elevation: 3,
    },
  });