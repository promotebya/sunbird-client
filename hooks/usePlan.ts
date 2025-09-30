// hooks/usePlan.ts
import { doc, onSnapshot } from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import { db } from '../firebaseConfig';

export type Plan = 'free' | 'premium';

export type UsePlanResult = {
  plan: Plan;
  isPremium: boolean;
  loading: boolean;
};

/** Robustly convert a Firestore Timestamp / millis / ISO to ms (or null). */
function toMillis(v: any): number | null {
  if (!v) return null;
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const ms = Date.parse(v);
    return Number.isFinite(ms) ? ms : null;
  }
  if (typeof v === 'object') {
    if (typeof v.toMillis === 'function') {
      try {
        return v.toMillis();
      } catch {}
    }
    if (typeof v.seconds === 'number') return Math.round(v.seconds * 1000);
  }
  return null;
}

/** Decide whether premium is active based on doc fields. */
function derivePremiumFromDoc(d: any): { plan: Plan; isPremium: boolean; premiumUntilMs: number | null } {
  const rawPlan = (d?.plan as Plan | undefined) ?? undefined;
  const legacyBool = d?.isPremium as boolean | undefined;
  const untilMs = toMillis(d?.premiumUntil);

  // If an expiry exists, it always wins.
  if (untilMs != null) {
    const active = untilMs > Date.now();
    return { plan: active ? 'premium' : 'free', isPremium: active, premiumUntilMs: untilMs };
  }

  // Otherwise fall back to explicit flags.
  if (rawPlan === 'premium' || legacyBool === true) {
    return { plan: 'premium', isPremium: true, premiumUntilMs: null };
  }

  return { plan: 'free', isPremium: false, premiumUntilMs: null };
}

/**
 * Rich plan hook that:
 *  - treats users without any plan fields as FREE,
 *  - respects `premiumUntil` for auto-expiry,
 *  - updates live when the timestamp passes (no reload needed).
 */
export function usePlanPlus(uid?: string | null): UsePlanResult {
  const [plan, setPlan] = useState<Plan>('free');
  const [loading, setLoading] = useState(true);
  const [isPremium, setIsPremium] = useState(false);

  const expiryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Clear any running timer whenever uid changes/unmounts
    if (expiryTimerRef.current) {
      clearTimeout(expiryTimerRef.current);
      expiryTimerRef.current = null;
    }

    if (!uid) {
      setPlan('free');
      setIsPremium(false);
      setLoading(false);
      return;
    }

    const ref = doc(db, 'users', uid);
    const off = onSnapshot(
      ref,
      (snap) => {
        const data = snap.exists() ? snap.data() : null;
        const derived = derivePremiumFromDoc(data);

        setPlan(derived.plan);
        setIsPremium(derived.isPremium);
        setLoading(false);

        // If we have a future expiry, set a one-shot timer to flip the UI exactly at expiry.
        if (expiryTimerRef.current) {
          clearTimeout(expiryTimerRef.current);
          expiryTimerRef.current = null;
        }
        if (derived.premiumUntilMs && derived.premiumUntilMs > Date.now()) {
          expiryTimerRef.current = setTimeout(() => {
            setPlan('free');
            setIsPremium(false);
          }, derived.premiumUntilMs - Date.now());
        }
      },
      () => {
        // Fail safe: never block UI if Firestore throws (offline/perms/etc.)
        setPlan('free');
        setIsPremium(false);
        setLoading(false);
      }
    );

    return () => {
      off();
      if (expiryTimerRef.current) {
        clearTimeout(expiryTimerRef.current);
        expiryTimerRef.current = null;
      }
    };
  }, [uid]);

  return { plan, isPremium, loading };
}

/** Back-compat shim: old code imports the string plan only. */
export default function usePlan(uid?: string | null): Plan {
  return usePlanPlus(uid).plan;
}