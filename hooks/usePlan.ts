// hooks/usePlan.ts
import { doc, onSnapshot } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { db } from '../firebaseConfig';

export type Plan = 'free' | 'premium';

export type UsePlanResult = {
  plan: Plan;
  /** Derived convenience boolean so callers don't have to compare strings */
  isPremium: boolean;
  /** True until the first snapshot resolves (or we decide there's no uid) */
  loading: boolean;
};

/**
 * Rich plan hook that exposes the raw `plan`, a derived `isPremium` boolean and a `loading` flag.
 * This keeps old code working (via the default export below) while giving newer screens
 * a nicer API without creating another hook file.
 */
export function usePlanPlus(uid?: string | null): UsePlanResult {
  const [plan, setPlan] = useState<Plan>('free');
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    // No user → default to free and resolve loading immediately.
    if (!uid) {
      setPlan('free');
      setLoading(false);
      return;
    }

    const ref = doc(db, 'users', uid);
    const off = onSnapshot(
      ref,
      (snap) => {
        const p = (snap.exists() ? (snap.data() as any)?.plan : null) as Plan | null;
        setPlan(p === 'premium' ? 'premium' : 'free');
        setLoading(false);
      },
      (err) => {
        // Fail safe: never block UI if Firestore throws (offline, perms, etc.)
        console.warn('[usePlan] onSnapshot error', err);
        setPlan('free');
        setLoading(false);
      }
    );

    return () => off();
  }, [uid]);

  return { plan, isPremium: plan === 'premium', loading };
}

/**
 * Backwards-compatible hook that returns only the string plan.
 * Existing imports keep working: `const plan = usePlan(uid)`
 */
export default function usePlan(uid?: string | null): Plan {
  return usePlanPlus(uid).plan;
}