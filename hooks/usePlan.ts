// hooks/usePlan.ts
import { doc, onSnapshot } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { db } from '../firebaseConfig';

export type Plan = 'free' | 'premium';

export type UsePlanResult = {
  plan: Plan;
  isPremium: boolean;
  loading: boolean;
};

function toMillis(v: any): number | null {
  if (!v) return null;
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const t = Date.parse(v);
    return Number.isNaN(t) ? null : t;
  }
  if (typeof v?.toMillis === 'function') return v.toMillis();
  return null;
}

/**
 * Defaults to FREE. Becomes PREMIUM only if:
 * - premiumUntil is in the future, OR
 * - plan === 'premium', OR
 * - isPremium === true
 * (premiumUntil takes precedence; if it's present but expired, we treat as FREE)
 */
export function usePlanPlus(uid?: string | null): UsePlanResult {
  const [plan, setPlan] = useState<Plan>('free');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setPlan('free');
      setLoading(false);
      return;
    }

    const ref = doc(db, 'users', uid);
    const off = onSnapshot(
      ref,
      (snap) => {
        const data = snap.exists() ? (snap.data() as any) : {};
        const untilMs = toMillis(data?.premiumUntil);
        const now = Date.now();
        const activeByUntil = untilMs != null && untilMs > now;

        // If premiumUntil exists but is expired -> force FREE regardless of other flags
        let premium = false;
        if (untilMs != null) {
          premium = activeByUntil;
        } else {
          premium = data?.plan === 'premium' || data?.isPremium === true;
        }

        setPlan(premium ? 'premium' : 'free');
        setLoading(false);
      },
      (_err) => {
        // Fail safe: never block UI
        setPlan('free');
        setLoading(false);
      }
    );
    return () => off();
  }, [uid]);

  return { plan, isPremium: plan === 'premium', loading };
}

/** Back-compat shim (old imports expect just the string) */
export default function usePlan(uid?: string | null): Plan {
  return usePlanPlus(uid).plan;
}