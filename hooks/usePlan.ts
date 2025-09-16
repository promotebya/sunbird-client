// hooks/usePlan.ts
import { doc, onSnapshot } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { db } from '../firebaseConfig';

export type Plan = 'free' | 'premium';

export default function usePlan(uid?: string | null) {
  const [plan, setPlan] = useState<Plan>('free');
  useEffect(() => {
    if (!uid) { setPlan('free'); return; }
    const ref = doc(db, 'users', uid);
    const off = onSnapshot(ref, (snap) => {
      const p = (snap.exists() ? snap.data()?.plan : null) as Plan | null;
      setPlan(p === 'premium' ? 'premium' : 'free');
    }, () => setPlan('free'));
    return () => off();
  }, [uid]);
  return plan;
}
