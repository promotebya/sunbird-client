// utils/streak.ts
import {
    doc, getDoc,
    onSnapshot, serverTimestamp,
    setDoc,
    Unsubscribe,
    updateDoc,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';

export type StreakDoc = {
  uid: string;
  current: number;
  longest?: number;
  lastActiveISO?: string;        // YYYY-MM-DD (last day counted into streak)
  todayCount?: number;           // completions today
  catchupPending?: boolean;      // user opted into catchup and hasn't satisfied 2 completions yet
  catchupBaseCurrent?: number;   // streak count before applying catchup
  catchupWeekISO?: string;       // YYYY-Www week the catchup was consumed
  catchupIntentWeekISO?: string; // week where user pressed "Catch-up day"
  updatedAt?: any;
};

export function isoDay(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

// ISO week (YYYY-Www)
export function isoWeekStr(d = new Date()): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  // Thursday in current week decides the year.
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  const week = String(weekNo).padStart(2, '0');
  return `${date.getUTCFullYear()}-W${week}`;
}

/** User taps "Catch-up day" chip — we record intent for the current ISO week. */
export async function activateCatchup(uid: string) {
  const ref = doc(db, 'streaks', uid);
  const now = new Date();
  const week = isoWeekStr(now);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      uid,
      current: 0,
      longest: 0,
      lastActiveISO: undefined,
      todayCount: 0,
      catchupPending: true,
      catchupBaseCurrent: 0,
      catchupIntentWeekISO: week,
      updatedAt: serverTimestamp(),
    });
    return;
  }
  const data = snap.data() as StreakDoc;
  if (data.catchupWeekISO === week || data.catchupIntentWeekISO === week) return; // already used/armed this week
  await updateDoc(ref, {
    catchupPending: true,
    catchupBaseCurrent: data.current ?? 0,
    catchupIntentWeekISO: week,
    updatedAt: serverTimestamp(),
  });
}

/** Call this whenever a task is completed. Handles normal streaks + catch-up logic. */
export async function notifyTaskCompletion(uid: string) {
  const ref = doc(db, 'streaks', uid);
  const today = new Date();
  const todayISO = isoDay(today);
  const week = isoWeekStr(today);

  const snap = await getDoc(ref);
  if (!snap.exists()) {
    // first ever completion — start streak
    await setDoc(ref, {
      uid,
      current: 1,
      longest: 1,
      lastActiveISO: todayISO,
      todayCount: 1,
      catchupPending: false,
      updatedAt: serverTimestamp(),
    });
    return;
  }

  const data = snap.data() as StreakDoc;
  const last = data.lastActiveISO;
  const prevDate = last ? new Date(last) : null;
  const y = new Date(); y.setDate(y.getDate() - 1);
  const yesterdayISO = isoDay(y);

  const alreadyCountedToday = last === todayISO;

  // Always increment today's local completion count
  const newTodayCount = (alreadyCountedToday ? (data.todayCount ?? 1) + 1 : 1);

  // 1) Already counted today: no streak changes, just update todayCount
  if (alreadyCountedToday) {
    await updateDoc(ref, {
      todayCount: newTodayCount,
      updatedAt: serverTimestamp(),
    });
    return;
  }

  // 2) Normal consecutive day
  if (last === yesterdayISO) {
    const nextCurrent = (data.current ?? 0) + 1;
    await updateDoc(ref, {
      current: nextCurrent,
      longest: Math.max(nextCurrent, data.longest ?? 0),
      lastActiveISO: todayISO,
      todayCount: 1,
      catchupPending: false,
      updatedAt: serverTimestamp(),
    });
    return;
  }

  // 3) Gap detected — try catch-up if available and not consumed this week
  const catchupAvailableThisWeek =
    data.catchupIntentWeekISO === week && data.catchupWeekISO !== week;

  if (catchupAvailableThisWeek) {
    // Arm pending if not already
    const base = data.catchupBaseCurrent ?? (data.current ?? 0);
    const pending = data.catchupPending ?? true;

    if (!pending) {
      await updateDoc(ref, {
        catchupPending: true,
        catchupBaseCurrent: base,
        todayCount: 1,
        updatedAt: serverTimestamp(),
      });
      return;
    }

    // If pending AND we now have >= 2 completions today, apply catchup
    if (newTodayCount >= 2) {
      const nextCurrent = base + 1; // restore continuity (as if yesterday counted)
      await updateDoc(ref, {
        current: nextCurrent,
        longest: Math.max(nextCurrent, data.longest ?? 0),
        lastActiveISO: todayISO,
        todayCount: newTodayCount,
        catchupPending: false,
        catchupWeekISO: week, // consume catchup for this week
        updatedAt: serverTimestamp(),
      });
      return;
    }

    // still pending: just update counters
    await updateDoc(ref, {
      todayCount: newTodayCount,
      updatedAt: serverTimestamp(),
    });
    return;
  }

  // 4) No catch-up: reset streak to 1
  await updateDoc(ref, {
    current: 1,
    longest: Math.max(1, data.longest ?? 0),
    lastActiveISO: todayISO,
    todayCount: 1,
    catchupPending: false,
    updatedAt: serverTimestamp(),
  });
}

export function listenStreak(uid: string, cb: (s: StreakDoc | null) => void): Unsubscribe {
  const ref = doc(db, 'streaks', uid);
  return onSnapshot(ref, (snap) => {
    cb(snap.exists() ? (snap.data() as StreakDoc) : null);
  });
}
