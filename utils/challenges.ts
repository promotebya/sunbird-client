import {
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';

/**
 * ---------------------------------------------------------------------------
 *  A) WEEKLY POINTS / REWARDS (kept for backward compatibility)
 * ---------------------------------------------------------------------------
 */

type Weekly = {
  weekKey: string;
  weekStart: Timestamp;
  target: number;
  status: 'active' | 'completed' | 'missed';
  progress?: number;
  weeklyStreak?: number;
  longestWeeklyStreak?: number;
  selectedRewardId?: string;
};

export function getWeekKey(date: Date, weekStartsOnMonday = true) {
  // ISO week: Monday=1…Sunday=7
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  if (weekStartsOnMonday) d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  // week number
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

export function getWeekRange(d: Date, tzOffsetMinutes = 0) {
  // Shift by tzOffset to simulate local week in that tz.
  const shifted = new Date(d.getTime() + tzOffsetMinutes * 60000);
  const day = shifted.getUTCDay() || 7; // Monday=1
  const monday = new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()));
  monday.setUTCDate(monday.getUTCDate() - (day - 1));
  monday.setUTCHours(0, 0, 0, 0);
  const nextMonday = new Date(monday);
  nextMonday.setUTCDate(nextMonday.getUTCDate() + 7);
  // Undo shift
  const start = new Date(monday.getTime() - tzOffsetMinutes * 60000);
  const end = new Date(nextMonday.getTime() - tzOffsetMinutes * 60000);
  return { start, end };
}

export async function sumPointsThisWeek(pairId: string, now: Date, tzOffsetMinutes: number) {
  const { start, end } = getWeekRange(now, tzOffsetMinutes);
  const q = query(
    collection(db, 'pointsHistory'),
    where('pairId', '==', pairId),
    where('createdAt', '>=', Timestamp.fromDate(start)),
    where('createdAt', '<', Timestamp.fromDate(end)),
    orderBy('createdAt', 'asc'),
  );
  const snap = await getDocs(q);
  let total = 0;
  snap.forEach((doc) => {
    const v = doc.data().value ?? 0;
    if (typeof v === 'number' && v > 0) total += v;
  });
  return { total, start, end };
}

export async function ensureWeekly(pairId: string, defaultTarget = 50, tzOffsetMinutes = 0) {
  const now = new Date();
  const key = getWeekKey(now, true);
  const pairsRef = doc(db, 'pairs', pairId);
  const weeklyRef = doc(db, 'pairs', pairId, 'weeklyHistory', key);
  const weeklyStateRef = doc(db, 'pairs', pairId);

  const [pSnap, wSnap] = await Promise.all([getDoc(pairsRef), getDoc(weeklyRef)]);
  const target = defaultTarget;

  if (!pSnap.exists()) throw new Error('Pair not found');

  const { total } = await sumPointsThisWeek(pairId, now, tzOffsetMinutes);

  // Initialize current-week state on pairs
  const current: Weekly = {
    weekKey: key,
    weekStart: Timestamp.fromDate(getWeekRange(now, tzOffsetMinutes).start),
    target,
    status: total >= target ? 'completed' : 'active',
    progress: total,
  };

  await updateDoc(weeklyStateRef, { weekly: current });

  if (!wSnap.exists()) {
    await setDoc(weeklyRef, {
      target,
      earned: total,
      completed: total >= target,
      ...(total >= target ? { completedAt: serverTimestamp() } : {}),
    });
  } else {
    await updateDoc(weeklyRef, {
      earned: total,
      ...(total >= target ? { completed: true, completedAt: serverTimestamp() } : {}),
    });
  }

  return current;
}

export async function claimWeeklyReward(pairId: string, rewardId: string, tzOffsetMinutes = 0) {
  const now = new Date();
  const key = getWeekKey(now, true);
  const weeklyRef = doc(db, 'pairs', pairId, 'weeklyHistory', key);
  const pairRef = doc(db, 'pairs', pairId);
  const wSnap = await getDoc(weeklyRef);
  if (!wSnap.exists()) throw new Error('Weekly doc missing');

  const data = wSnap.data();
  if (!data.completed) throw new Error('Target not yet met');

  await updateDoc(weeklyRef, { rewardId });
  // increment streaks
  const pSnap = await getDoc(pairRef);
  const prev = (pSnap.data()?.weekly?.weeklyStreak ?? 0) + 1;
  const longest = Math.max(prev, pSnap.data()?.weekly?.longestWeeklyStreak ?? 0);

  await updateDoc(pairRef, {
    'weekly.selectedRewardId': rewardId,
    'weekly.weeklyStreak': prev,
    'weekly.longestWeeklyStreak': longest,
  });
}

/**
 * ---------------------------------------------------------------------------
 *  B) CHALLENGES ENGINE (rotation + gating + state)
 * ---------------------------------------------------------------------------
 */

// Tiers (romantic names)
export type Tier = 'easy' | 'medium' | 'hard' | 'super';
export const TIER_LABELS: Record<Tier, string> = {
  easy: 'Tender Moments',
  medium: 'Heart to Heart',
  hard: 'Passionate Quests',
  super: 'Forever & Always',
};

// Unlock gates (points required this week; NOT spent)
export const UNLOCK_REQUIREMENT: Record<Tier, number> = {
  easy: 0,
  medium: 10,
  hard: 20,
  super: 30,
};

// Plan quotas
export const QUOTAS = {
  free: { open: { easy: 1 }, unlockable: { hard: 1 } },
  premium: { open: { easy: 3 }, unlockable: { medium: 3, hard: 3, super: 3 } },
};

export type Category = 'all' | 'dates' | 'kindness' | 'talk' | 'surprise' | 'play';

export type ChallengeDef = {
  id: string;
  title: string;
  tier: Tier;
  category: Exclude<Category, 'all'>;
};

// Minimal bank (expand to 50 per tier/category in your app)
export const BANK: ChallengeDef[] = [
  { id: 'e_dates_picnic',   title: 'Pack a tiny picnic for sunset', tier: 'easy',   category: 'dates' },
  { id: 'e_kindness_note',  title: 'Hide a little appreciation note', tier: 'easy', category: 'kindness' },
  { id: 'e_talk_roses',     title: 'Share 3 “roses” from your day', tier: 'easy',   category: 'talk' },
  { id: 'e_surprise_snap',  title: 'Send a candid “thinking of you” snap', tier: 'easy', category: 'surprise' },
  { id: 'e_play_walk',      title: '10‑minute fresh‑air walk together', tier: 'easy', category: 'play' },

  { id: 'm_talk_questions', title: 'Answer 10 playful “this or that”s', tier: 'medium', category: 'talk' },
  { id: 'm_surprise_song',  title: 'Send a song that feels like us',    tier: 'medium', category: 'surprise' },
  { id: 'm_dates_try',      title: 'Try a new dessert place',           tier: 'medium', category: 'dates' },

  { id: 'h_play_dance',     title: 'Impromptu kitchen dance (full song)', tier: 'hard', category: 'play' },
  { id: 'h_dates_new',      title: 'Explore a totally new café',        tier: 'hard',   category: 'dates' },
  { id: 'h_talk_memories',  title: 'Swap 3 favorite memories of us',    tier: 'hard',   category: 'talk' },

  { id: 's_dates_daytrip',  title: 'Plan a mini day trip this week',    tier: 'super',  category: 'dates' },
  { id: 's_talk_deep',      title: '“What do you need more of lately?” talk', tier: 'super', category: 'talk' },
  { id: 's_play_surprise',  title: 'Secret plan with a reveal moment',  tier: 'super',  category: 'surprise' },
];

export type WeeklyState = {
  [challengeId: string]: {
    opened: boolean;
    completed?: boolean;
    unlockedAt?: any;
    tier: Tier;
  };
};

export type WeeklyItem = ChallengeDef & {
  opened: boolean;
  completed?: boolean;
  lockedReason?: string; // e.g., "Need 10 weekly points"
};

// Deterministic rotation helpers
function seededRandom(seed: number) {
  return function () {
    // Mulberry32
    let t = (seed += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const makeSeed = (uid: string, weekISO: string) =>
  Array.from(uid + weekISO).reduce((a, c) => a + c.charCodeAt(0), 0);

function pick<T>(arr: T[], n: number, rng: () => number) {
  if (n <= 0) return [];
  const copy = arr.slice();
  const out: T[] = [];
  while (copy.length && out.length < n) {
    const i = Math.floor(rng() * copy.length);
    out.push(copy.splice(i, 1)[0]);
  }
  return out;
}

export const currentWeekKey = (d = new Date()) => getWeekKey(d, true);

/**
 * Choose this week’s visible items (opened + unlockable) for a given user.
 * `isPremium` controls quotas; `category` filters; picks are deterministic for user+week.
 */
export function plannedForThisWeek(
  uid: string,
  isPremium: boolean,
  category: Category,
  weekISO = currentWeekKey(),
): WeeklyItem[] {
  const rng = seededRandom(makeSeed(uid, weekISO));
  const quota = isPremium ? QUOTAS.premium : QUOTAS.free;

  const filterByCat = (x: ChallengeDef) => (category === 'all' ? true : x.category === category);

  const byTier = {
    easy:   BANK.filter((b) => b.tier === 'easy'   && filterByCat(b)),
    medium: BANK.filter((b) => b.tier === 'medium' && filterByCat(b)),
    hard:   BANK.filter((b) => b.tier === 'hard'   && filterByCat(b)),
    super:  BANK.filter((b) => b.tier === 'super'  && filterByCat(b)),
  };

  // how many to present (opened + unlockable) for each tier
  const presentCounts: Partial<Record<Tier, number>> = {};
  (['easy', 'medium', 'hard', 'super'] as Tier[]).forEach((tier) => {
    const openCount = (quota.open as any)[tier] ?? 0;
    const unlockableCount = (quota.unlockable as any)[tier] ?? 0;
    const total = openCount + unlockableCount;
    if (total > 0) presentCounts[tier] = total;
  });

  const picks: ChallengeDef[] = [];
  (Object.keys(presentCounts) as Tier[]).forEach((tier) => {
    const pool = byTier[tier];
    picks.push(...pick(pool, presentCounts[tier]!, rng));
  });

  // mark which should be opened by default
  const openedBudget: Partial<Record<Tier, number>> = { ...(quota.open as any) };

  const planned = picks.map<WeeklyItem>((c) => {
    const shouldOpen = (openedBudget as any)[c.tier] > 0;
    if (shouldOpen) (openedBudget as any)[c.tier]!--;

    let lockedReason: string | undefined;
    if (!shouldOpen) {
      const need = UNLOCK_REQUIREMENT[c.tier];
      if (need > 0) lockedReason = `Need ${need} weekly points`;
    }
    return { ...c, opened: !!shouldOpen, lockedReason };
  });

  return planned;
}

// Firestore state (per user + week)
export function weeklyDocRef(uid: string, weekISO = currentWeekKey()) {
  return doc(db, 'challengeWeeks', `${uid}_${weekISO}`);
}

export function subscribeWeeklyState(
  uid: string,
  weekISO: string,
  cb: (state: WeeklyState) => void,
) {
  return onSnapshot(weeklyDocRef(uid, weekISO), (snap) => {
    const data = (snap.exists() ? (snap.data() as any) : null) || {};
    cb((data.state as WeeklyState) ?? {});
  });
}

export async function ensureWeeklyDoc(uid: string, weekISO: string) {
  await setDoc(weeklyDocRef(uid, weekISO), { state: {}, updatedAt: serverTimestamp() }, { merge: true });
}

export async function unlockChallenge(uid: string, weekISO: string, challenge: ChallengeDef) {
  await updateDoc(weeklyDocRef(uid, weekISO), {
    [`state.${challenge.id}`]: {
      opened: true,
      unlockedAt: serverTimestamp(),
      tier: challenge.tier,
    },
    updatedAt: serverTimestamp(),
  });
}

export async function toggleComplete(uid: string, weekISO: string, challengeId: string, completed: boolean) {
  await updateDoc(weeklyDocRef(uid, weekISO), {
    [`state.${challengeId}.completed`]: completed,
    updatedAt: serverTimestamp(),
  });
}
