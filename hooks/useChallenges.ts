// hooks/useChallenges.ts
import { collection, doc, getDocs, onSnapshot, orderBy, query, setDoc, where } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import { db } from '../firebaseConfig';

export type Challenge = {
  id: string;
  title: string;
  subtitle?: string;
  description?: string;
  tier: number;               // 1..5
  pointsRequired: number;     // total points to unlock
  estDurationMin?: number;
  isPremium?: boolean;
  tags?: string[];
  steps?: string[];
  image?: string | null;
};

export type UserChallenge = {
  id: string;                 // equals Challenge.id
  ownerId: string;
  pairId?: string | null;
  status: 'locked' | 'unlocked' | 'in_progress' | 'completed';
  startedAt?: any | null;
  completedAt?: any | null;
  notes?: string | null;
};

export function useChallenges(
  uid: string | undefined | null,
  totalPoints: number,
  hasPro: boolean
) {
  const [all, setAll] = useState<Challenge[]>([]);
  const [mine, setMine] = useState<UserChallenge[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'challenges'), orderBy('pointsRequired', 'asc'));
    getDocs(q).then((s) => setAll(s.docs.map((d) => ({ id: d.id, ...(d.data() as any) }))));
  }, []);

  useEffect(() => {
    if (!uid) return;
    const q = query(collection(db, 'userChallenges'), where('ownerId', '==', uid));
    return onSnapshot(q, (s) => setMine(s.docs.map((d) => ({ id: d.id, ...(d.data() as any) }))));
  }, [uid]);

  const myStatuses = useMemo<UserChallenge[]>(() => {
    const map = new Map(mine.map((m) => [m.id, m]));
    return all.map((c) => {
      const uc = map.get(c.id);
      if (uc) return uc;
      const premiumGate = c.isPremium && !hasPro;
      if (premiumGate) {
        return { id: c.id, ownerId: uid!, status: 'locked' } as UserChallenge;
      }
      const unlocked = totalPoints >= (c.pointsRequired ?? 0);
      return { id: c.id, ownerId: uid!, status: unlocked ? 'unlocked' : 'locked' } as UserChallenge;
    });
  }, [all, mine, totalPoints, hasPro, uid]);

  async function mark(id: string, next: UserChallenge['status']) {
    if (!uid) return;
    await setDoc(
      doc(db, 'userChallenges', `${uid}_${id}`),
      {
        id,
        ownerId: uid,
        status: next,
        startedAt: next === 'in_progress' ? new Date() : null,
        completedAt: next === 'completed' ? new Date() : null,
      },
      { merge: true }
    );
  }

  return { challenges: all, myStatuses, mark };
}
