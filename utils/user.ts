// utils/user.ts
import {
    doc,
    getDoc,
    runTransaction,
    serverTimestamp,
    setDoc,
} from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';
import { addPoints } from './points';

export type UserProfile = {
  name?: string;
  email?: string;
  lastCheckInDay?: number; // YYYYMMDD (UTC)
  streak?: number;
  streakSavers?: number;   // how many savers are available to use
  createdAt?: any;
  updatedAt?: any;
};

export const userRef = (uid: string) => doc(db, 'users', uid);

export async function ensureUser(uid: string, data?: Partial<UserProfile>) {
  const ref = userRef(uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      ...data,
      streak: 0,
      lastCheckInDay: 0,
      streakSavers: 1, // start with 1 free saver; tune as you like or gate behind premium
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
}

const yyyymmddUtc = (d = new Date()) =>
  d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();

/**
 * Daily check-in
 * - awards points once/day
 * - maintains streaks
 * - optional Streak Saver: if you missed >1 day and have savers, you can keep your streak
 */
export async function checkInDaily(
  uid: string,
  opts?: { points?: number; useStreakSaver?: boolean }
): Promise<{ awarded: boolean; streak: number; saverUsed: boolean }> {
  const pointsToAward = opts?.points ?? 10;
  const wantSaver = !!opts?.useStreakSaver;
  const today = yyyymmddUtc();

  const result = await runTransaction(db, async (tx) => {
    const ref = userRef(uid);
    const snap = await tx.get(ref);
    const data = (snap.data() as UserProfile) ?? {};
    const last = data.lastCheckInDay ?? 0;
    let streak = data.streak ?? 0;
    let saverUsed = false;

    // Already checked in today
    if (last === today) {
      return { awarded: false, streak, saverUsed };
    }

    const gap = today - last; // naive across months/years, but OK for daily counters (YYYYMMDD)
    const missed = gap > 1;

    if (!missed) {
      // consecutive day
      streak = streak + 1 || 1;
    } else {
      // You missed at least one day
      if (wantSaver && (data.streakSavers ?? 0) > 0) {
        // save the streak (don't reset), spend a saver
        streak = streak + 1 || 1;
        saverUsed = true;
        tx.set(
          ref,
          {
            streakSavers: (data.streakSavers ?? 0) - 1,
          },
          { merge: true }
        );
      } else {
        // no saver (or not using it) → reset streak
        streak = 1;
      }
    }

    tx.set(
      ref,
      {
        lastCheckInDay: today,
        streak,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    return { awarded: true, streak, saverUsed };
  });

  if (result.awarded) {
    await addPoints(uid, pointsToAward, { source: 'daily', note: result.saverUsed ? 'Streak Saver' : 'Daily check-in' });
  }

  return result;
}
