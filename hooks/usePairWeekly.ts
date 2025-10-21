// hooks/usePairWeekly.ts
import { doc, onSnapshot } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { db } from '../firebaseConfig';
import { isoWeekStr } from '../utils/streak';

export function usePairWeekly(pairId?: string | null) {
  const [weekPts, setWeekPts] = useState<number>(0);

  useEffect(() => {
    if (!pairId) { setWeekPts(0); return; }
    const weekKey = isoWeekStr(new Date()); // same helper you already use
    const ref = doc(db, 'pairs', pairId, 'weekly', weekKey);
    const off = onSnapshot(ref, (snap) => {
      const v = Number((snap.data() as any)?.points ?? 0);
      setWeekPts(Number.isFinite(v) ? v : 0);
    }, () => setWeekPts(0));
    return () => off && off();
  }, [pairId]);

  return weekPts;
}