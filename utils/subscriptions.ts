// utils/subscriptions.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

// Flip to false once you wire RevenueCat/StoreKit
const USE_MOCK = true;

export type Offering = { identifier: string; priceString: string };
export type Offerings = { monthly?: Offering; annual?: Offering };

/** Storage key scoped by UID so Premium is per-account (not per-device). */
const keyFor = (uid: string | null | undefined) => `lp:pro_entitlement:${uid ?? 'anon'}`;

// --- module-level state so all hooks stay in sync (for the *current* UID) ---
let currentUid: string | null = null;
let proState = false;
let loaded = false;

const listeners = new Set<(v: boolean) => void>();
function notify() {
  listeners.forEach((cb) => cb(proState));
}

/** cache per uid so we don’t re-read storage repeatedly */
const cache = new Map<string, { loaded: boolean; pro: boolean }>();

async function loadOnce(uid: string | null) {
  const k = keyFor(uid);
  const c = cache.get(k);
  if (c?.loaded) return c.pro;

  const pro = (await AsyncStorage.getItem(k)) === '1';
  cache.set(k, { loaded: true, pro });
  return pro;
}

/** Switch the subscriptions “context” to a specific UID (or anon). */
export async function setCurrentSubscriptionsUser(uid: string | null) {
  currentUid = uid ?? null;
  proState = await loadOnce(currentUid);
  loaded = true;
  notify();
}

/** Hook: offerings + entitlement for the *passed* UID */
export function usePro(uid?: string | null) {
  const [hasPro, setHasProLocal] = useState<boolean>(proState);
  const [loading, setLoading] = useState<boolean>(!loaded);
  const [offerings, setOfferings] = useState<Offerings | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      // Scope module state to this uid
      await setCurrentSubscriptionsUser(uid ?? null);
      if (!alive) return;

      setHasProLocal(proState);
      setLoading(false);

      if (USE_MOCK) {
        setOfferings({
          monthly: { identifier: 'lp_plus_monthly', priceString: '€2.99' },
          annual: { identifier: 'lp_plus_annual', priceString: '€19.99' },
        });
      } else {
        // TODO RevenueCat:
        // Purchases.getOfferings() -> setOfferings(...)
        // Purchases.getCustomerInfo() -> setHasProLocal(active entitlement)
      }
    })();

    // stay in sync with module state
    const sub = (v: boolean) => setHasProLocal(v);
    listeners.add(sub);
    return () => {
      alive = false;
      listeners.delete(sub);
    };
  }, [uid]);

  // Expose a setter (used by mock purchase/restore)
  const setHasPro = async (v: boolean) => {
    const k = keyFor(currentUid);
    proState = v;
    cache.set(k, { loaded: true, pro: v });
    await AsyncStorage.setItem(k, v ? '1' : '0');
    notify();
  };

  return { loading, hasPro, setHasPro, offerings };
}

// ---- actions (mocked) ------------------------------------------------------

export async function purchase(_o: Offering): Promise<boolean> {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 400)); // tiny “store” delay
    const k = keyFor(currentUid);
    proState = true;
    cache.set(k, { loaded: true, pro: true });
    await AsyncStorage.setItem(k, '1');
    notify();
    return true;
  }
  // TODO RevenueCat: Purchases.purchasePackage(...) then set based on entitlement
  return false;
}

export async function restore(): Promise<boolean> {
  if (USE_MOCK) {
    const k = keyFor(currentUid);
    const v = (await AsyncStorage.getItem(k)) === '1';
    proState = v;
    cache.set(k, { loaded: true, pro: v });
    notify();
    return v;
  }
  // TODO RevenueCat: Purchases.restorePurchases() then set based on entitlement
  return false;
}

// Handy for local testing from a dev menu, optional:
export async function _debugResetPro() {
  const k = keyFor(currentUid);
  proState = false;
  cache.set(k, { loaded: true, pro: false });
  await AsyncStorage.setItem(k, '0');
  notify();
}