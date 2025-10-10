// hooks/usePointsTotal.ts
import { doc, onSnapshot } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { db } from '../firebaseConfig';
import { listenTotalPoints, listenWeekPoints } from '../utils/points';

export default function usePointsTotal(uid?: string | null) {
  const [pairId, setPairId] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [weekly, setWeekly] = useState(0);
  const [popped, setPopped] = useState(false);

  // Live-listen to my user doc so pairId updates immediately on link/unlink
  useEffect(() => {
    if (!uid) {
      setPairId(null);
      return;
    }
    const uref = doc(db, 'users', uid);
    const off = onSnapshot(
      uref,
      (snap) => {
        const data = snap.data() as any;
        setPairId((data?.pairId as string | null) ?? null);
      },
      () => {
        // If for some reason we cannot read our user doc, behave as unpaired
        setPairId(null);
      }
    );
    return () => off();
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    const offTotal = listenTotalPoints(uid, pairId, (t) => {
      setPopped(t > total);
      setTotal(t);
    });
    const offWeek = listenWeekPoints(uid, pairId, (w) => setWeekly(w));
    return () => {
      offTotal && offTotal();
      offWeek && offWeek();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, pairId]);

  return { total, weekly, popped, pairId };
}