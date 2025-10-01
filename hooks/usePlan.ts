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

// Accept Firestore Timestamp, Date, number (ms), or ISO string
function isFuture(d: any): boolean {
  if (!d) return false;
  try {
    const t =
      typeof d?.toDate === 'function' ? d.toDate().getTime()
      : d instanceof Date                  ? d.getTime()
      : typeof d === 'number'              ? d
      : typeof d === 'string'              ? new Date(d).getTime()
      : NaN;
    return Number.isFinite(t) && t > Date.now();
  } catch {
    return false;
  }
}

/**
 * Authoritative plan resolver:
 * - Defaults to FREE.
 * - PREMIUM if any of:
 *   - users/{uid}.plan === 'premium'
 *   - users/{uid}.isPremium === true (legacy support)
 *   - users/{uid}.premiumUntil is in the future (timestamp/ISO/date/number)
 */
export function usePlanPlus(uid?: string | null): UsePlanResult {
  const [state, setState] = useState<{ plan: Plan; loading: boolean }>({
    plan: 'free',
    loading: !!uid,
  });

  useEffect(() => {
    if (!uid) {
      setState({ plan: 'free', loading: false });
      return;
    }

    const ref = doc(db, 'users', uid);
    const off = onSnapshot(
      ref,
      (snap) => {
        const data = snap.exists() ? (snap.data() as any) : null;
        const premium =
          data?.plan === 'premium' ||
          data?.isPremium === true ||
          isFuture(data?.premiumUntil);
        setState({ plan: premium ? 'premium' : 'free', loading: false });
      },
      () => {
        // Fail safe: never block UI if Firestore throws (offline, perms, etc.)
        setState({ plan: 'free', loading: false });
      }
    );

    return () => off();
  }, [uid]);

  return {
    plan: state.plan,
    isPremium: state.plan === 'premium',
    loading: state.loading,
  };
}

/** Back-compat shim (old imports expect just the string) */
export default function usePlan(uid?: string | null): Plan {
  return usePlanPlus(uid).plan;
}