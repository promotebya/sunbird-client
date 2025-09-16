import { Timestamp, collection, doc, getDoc, getDocs, orderBy, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';
import { db } from '../firebaseConfig';

type Weekly = {
  weekKey: string;
  weekStart: Timestamp;
  target: number;
  status: 'active'|'completed'|'missed';
  progress?: number;
  weeklyStreak?: number;
  longestWeeklyStreak?: number;
  selectedRewardId?: string;
};

export function getWeekKey(date: Date, weekStartsOnMonday = true) {
  // ISO week: Monday=1…Sunday=7
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = (d.getUTCDay() || 7);
  if (weekStartsOnMonday) d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  // week number
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2,'0')}`;
}

export function getWeekRange(d: Date, tzOffsetMinutes = 0) {
  // Shift by tzOffset to simulate local week in that tz.
  const shifted = new Date(d.getTime() + tzOffsetMinutes * 60000);
  const day = (shifted.getUTCDay() || 7); // Monday=1
  const monday = new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()));
  monday.setUTCDate(monday.getUTCDate() - (day - 1));
  monday.setUTCHours(0,0,0,0);
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
    orderBy('createdAt', 'asc')
  );
  const snap = await getDocs(q);
  let total = 0;
  snap.forEach(doc => {
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
    status: (total >= target) ? 'completed' : 'active',
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
