// utils/subscriptions.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

// Flip to false once you wire RevenueCat/StoreKit
const USE_MOCK = true;

export type Offering = { identifier: string; priceString: string };
export type Offerings = { monthly?: Offering; annual?: Offering };

const PRO_KEY = 'lp:pro_entitlement';

// --- module-level state so all hooks stay in sync ---
let proState = false;
let loaded = false;
const listeners = new Set<(v: boolean) => void>();
function notify() { listeners.forEach(cb => cb(proState)); }

async function loadOnce() {
  if (loaded) return proState;
  try { proState = (await AsyncStorage.getItem(PRO_KEY)) === '1'; }
  finally { loaded = true; }
  return proState;
}

export function usePro() {
  const [hasPro, setHasProLocal] = useState<boolean>(proState);
  const [loading, setLoading] = useState<boolean>(!loaded);
  const [offerings, setOfferings] = useState<Offerings | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      await loadOnce();
      if (!alive) return;
      setHasProLocal(proState);
      setLoading(false);

      if (USE_MOCK) {
        setOfferings({
          monthly: { identifier: 'lp_plus_monthly', priceString: '€2.99' },
          annual:  { identifier: 'lp_plus_annual',  priceString: '€19.99' },
        });
      } else {
        // TODO RevenueCat:
        // - configure SDK
        // - const res = await Purchases.getOfferings();
        // - setOfferings({ monthly: ..., annual: ... })
        // - const pro = has active entitlement "pro"
        // - proState = pro; notify();
      }
    })();

    const sub = (v: boolean) => setHasProLocal(v);
    listeners.add(sub);
    return () => { alive = false; listeners.delete(sub); };
  }, []);

  // Expose a setter (used by mock purchase/restore)
  const setHasPro = async (v: boolean) => {
    proState = v;
    await AsyncStorage.setItem(PRO_KEY, v ? '1' : '0');
    notify();
  };

  return { loading, hasPro, setHasPro, offerings };
}

// ---- actions ------------------------------------------------

export async function purchase(_o: Offering): Promise<boolean> {
  if (USE_MOCK) {
    await new Promise(r => setTimeout(r, 400)); // tiny “store” delay
    proState = true;
    await AsyncStorage.setItem(PRO_KEY, '1');
    notify();
    return true;
  }
  // TODO RevenueCat: await Purchases.purchasePackage(...); then set proState by entitlement
  return false;
}

export async function restore(): Promise<boolean> {
  if (USE_MOCK) {
    const v = (await AsyncStorage.getItem(PRO_KEY)) === '1';
    proState = v;
    notify();
    return v;
  }
  // TODO RevenueCat: await Purchases.restorePurchases(); then set proState by entitlement
  return false;
}

// Handy for local testing from a dev menu, optional:
export async function _debugResetPro() {
  proState = false;
  await AsyncStorage.setItem(PRO_KEY, '0');
  notify();
}