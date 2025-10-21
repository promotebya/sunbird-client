// hooks/usePairPointsTotal.ts
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { db } from '../firebaseConfig';

export default function usePairPointsTotal(pairId?: string | null) {
  const [total, setTotal] = useState<number>(0);

  useEffect(() => {
    if (!pairId) { setTotal(0); return; }
    const qRef = query(collection(db, 'points'), where('pairId', '==', pairId));
    const unsub = onSnapshot(
      qRef,
      (snap) => {
        let sum = 0;
        for (const d of snap.docs) {
          const v = Number((d.data() as any)?.value ?? 0);
          if (Number.isFinite(v) && v > 0) sum += v;
        }
        setTotal(sum);
      },
      () => setTotal(0)
    );
    return () => unsub && unsub();
  }, [pairId]);

  return total;
}