// utils/subscriptions.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as IAP from 'expo-in-app-purchases';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

/**
 * ─────────────────────────────────────────────────────────────
 * CONFIG
 * ─────────────────────────────────────────────────────────────
 *
 * We only enable the real store on iOS in release builds.
 * - Dev builds = mocked (no App Store prompts)
 * - Android = temporarily mocked (we'll wire GP later)
 */
const STORE_ENABLED = Platform.OS === 'ios' && !__DEV__;
const USE_MOCK = !STORE_ENABLED;

// Your iOS product IDs (must match App Store Connect exactly)
export const IOS_PRODUCT_IDS = ['lp_premium_monthly', 'lp_premium_yearly'] as const;

// Types your UI expects
export type Offering = { identifier: string; priceString: string };
export type Offerings = { monthly?: Offering; annual?: Offering };

/**
 * ─────────────────────────────────────────────────────────────
 * Entitlement state (per current UID)
 * ─────────────────────────────────────────────────────────────
 */
const keyFor = (uid: string | null | undefined) => `lp:pro_entitlement:${uid ?? 'anon'}`;

let currentUid: string | null = null;
let proState = false;
let loaded = false;

const listeners = new Set<(v: boolean) => void>();
function notify() {
  for (const cb of listeners) cb(proState);
}

const cache = new Map<string, { loaded: boolean; pro: boolean }>();

async function loadOnce(uid: string | null) {
  const k = keyFor(uid);
  const c = cache.get(k);
  if (c?.loaded) return c.pro;
  const pro = (await AsyncStorage.getItem(k)) === '1';
  cache.set(k, { loaded: true, pro });
  return pro;
}

export async function setCurrentSubscriptionsUser(uid: string | null) {
  currentUid = uid ?? null;
  proState = await loadOnce(currentUid);
  loaded = true;
  notify();
}

/**
 * ─────────────────────────────────────────────────────────────
 * IAP bootstrap + purchase listener (configure once)
 * ─────────────────────────────────────────────────────────────
 */
let iapReady = false;
let listenerSet = false;
let productsCached: Array<{
  productId: string;
  price: string; // localized price string
}> | null = null;

async function ensureIAP() {
  if (USE_MOCK) return;
  if (iapReady) return;

  // Connect to StoreKit
  try {
    await IAP.connectAsync();
  } catch {
    throw new Error('IAP connect failed');
  }

  // Prime product cache (helps iPad reviewers where queries can be slow)
  try {
    const { responseCode, results } = await IAP.getProductsAsync(
      IOS_PRODUCT_IDS as unknown as string[]
    );
    if (responseCode === IAP.IAPResponseCode.OK && results?.length) {
      productsCached = results.map((r: any) => ({
        productId: r.productId,
        price: r.price, // already localized string
      }));
    } else {
      productsCached = [];
    }
  } catch {
    productsCached = [];
  }

  // One global listener that flips entitlement once Apple confirms a purchase
  if (!listenerSet) {
    IAP.setPurchaseListener(async (result) => {
      try {
        const ok = result.responseCode === IAP.IAPResponseCode.OK;
        if (!ok || !result.results?.length) return;

        for (const p of result.results) {
          const pid = p.productId ?? '';
          const ours = (IOS_PRODUCT_IDS as readonly string[]).includes(pid);
          const hasReceipt = !!(p.transactionReceipt || p.purchaseToken);

          // We mark entitlement once we have a receipt and it's one of our SKUs
          if (ours && hasReceipt) {
            const k = keyFor(currentUid);
            proState = true;
            cache.set(k, { loaded: true, pro: true });
            await AsyncStorage.setItem(k, '1');
            notify();
          }

          // Always finish the transaction
          try {
            await IAP.finishTransactionAsync(p, true /* consume ignored on iOS */);
          } catch {
            // swallow finish errors; StoreKit will retry
          }
        }
      } catch {
        // ignore listener errors to avoid crashing the app
      }
    });
    listenerSet = true;
  }

  iapReady = true;
}

/**
 * ─────────────────────────────────────────────────────────────
 * Hook: offerings + entitlement for the passed UID (no auto-restore)
 * ─────────────────────────────────────────────────────────────
 */
export function usePro(uid?: string | null) {
  const [hasPro, setHasProLocal] = useState<boolean>(proState);
  const [loading, setLoading] = useState<boolean>(!loaded);
  const [offerings, setOfferings] = useState<Offerings | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      await setCurrentSubscriptionsUser(uid ?? null);

      if (USE_MOCK) {
        // Dev preview prices (keep in sync with App Store)
        setOfferings({
          monthly: { identifier: 'lp_premium_monthly', priceString: '€2.99' },
          annual: { identifier: 'lp_premium_yearly', priceString: '€19.99' },
        });
        setHasProLocal(proState);
        setLoading(false);
        return;
      }

      try {
        await ensureIAP();

        // Use cached products if available, otherwise query once
        let prods = productsCached;
        if (!prods || prods.length === 0) {
          const { responseCode, results } = await IAP.getProductsAsync(
            IOS_PRODUCT_IDS as unknown as string[]
          );
          if (responseCode === IAP.IAPResponseCode.OK && results?.length) {
            prods = results.map((r: any) => ({ productId: r.productId, price: r.price }));
            productsCached = prods;
          } else {
            prods = [];
          }
        }

        if (prods.length) {
          const m = prods.find((p) => p.productId === 'lp_premium_monthly');
          const y = prods.find((p) => p.productId === 'lp_premium_yearly');
          setOfferings({
            monthly: m ? { identifier: m.productId, priceString: m.price } : undefined,
            annual: y ? { identifier: y.productId, priceString: y.price } : undefined,
          });
        } else {
          // Store not ready → keep CTA disabled
          setOfferings(null);
        }

        setHasProLocal(proState);
      } catch {
        setOfferings(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    const sub = (v: boolean) => setHasProLocal(v);
    listeners.add(sub);
    return () => {
      alive = false;
      listeners.delete(sub);
    };
  }, [uid]);

  // Setter used by dev mocks only
  const setHasPro = async (v: boolean) => {
    const k = keyFor(currentUid);
    proState = v;
    cache.set(k, { loaded: true, pro: v });
    await AsyncStorage.setItem(k, v ? '1' : '0');
    notify();
  };

  return { loading, hasPro, setHasPro, offerings };
}

/**
 * ─────────────────────────────────────────────────────────────
 * Actions
 * ─────────────────────────────────────────────────────────────
 */
export async function purchase(o: Offering): Promise<boolean> {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 350));
    const k = keyFor(currentUid);
    proState = true;
    cache.set(k, { loaded: true, pro: true });
    await AsyncStorage.setItem(k, '1');
    notify();
    return true;
  }

  await ensureIAP();

  // If products aren’t available, surface a graceful failure
  if (!productsCached || !productsCached.find((p) => p.productId === o.identifier)) {
    try {
      const { responseCode, results } = await IAP.getProductsAsync(
        IOS_PRODUCT_IDS as unknown as string[]
      );
      if (responseCode !== IAP.IAPResponseCode.OK || !results?.length) {
        return false;
      }
      productsCached = results.map((r: any) => ({ productId: r.productId, price: r.price }));
    } catch {
      return false;
    }
  }

  try {
    await IAP.purchaseItemAsync(o.identifier);
    // Entitlement flips in the listener after Apple confirms the purchase.
    return proState;
  } catch (e: any) {
    // If the reviewer taps "Cancel" or StoreKit refuses, just return false
    const code = e?.code ?? e?.message ?? '';
    if (String(code).includes('E_USER_CANCELLED') || String(code).includes('USER_CANCELED')) {
      return false;
    }
    return false;
  }
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

  await ensureIAP();

  try {
    // iOS restore: look at historical purchases for our SKUs
    const hist = await IAP.getPurchaseHistoryAsync({ useGooglePlayCache: false }).catch(() => null);

    const hasAny = !!hist?.results?.some((p) =>
      (IOS_PRODUCT_IDS as readonly string[]).includes(p.productId ?? '')
    );

    const k = keyFor(currentUid);
    proState = hasAny;
    cache.set(k, { loaded: true, pro: hasAny });
    await AsyncStorage.setItem(k, hasAny ? '1' : '0');
    notify();
    return hasAny;
  } catch {
    return false;
  }
}

/** Optional: dev helper to clear entitlement locally */
export async function _debugResetPro() {
  const k = keyFor(currentUid);
  proState = false;
  cache.set(k, { loaded: true, pro: false });
  await AsyncStorage.setItem(k, '0');
  notify();
}