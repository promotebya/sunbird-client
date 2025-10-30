// utils/subscriptions.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as IAP from 'expo-in-app-purchases';
import { useEffect, useState } from 'react';

// ──────────────────────────────────────────────────────────────
// CONFIG
// ──────────────────────────────────────────────────────────────

// Mocks only in dev; real StoreKit in release
const USE_MOCK = __DEV__;

// Your iOS product IDs (must match App Store Connect exactly)
export const IOS_PRODUCT_IDS = ['lp_premium_monthly', 'lp_premium_yearly'] as const;

// Types your UI expects
export type Offering = { identifier: string; priceString: string };
export type Offerings = { monthly?: Offering; annual?: Offering };

// ──────────────────────────────────────────────────────────────
// Entitlement state (global for current UID)
// ──────────────────────────────────────────────────────────────
const keyFor = (uid: string | null | undefined) => `lp:pro_entitlement:${uid ?? 'anon'}`;

let currentUid: string | null = null;
let proState = false;
let loaded = false;

const listeners = new Set<(v: boolean) => void>();
function notify() {
  listeners.forEach((cb) => cb(proState));
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

// ──────────────────────────────────────────────────────────────
// IAP bootstrap + purchase listener (configure once)
// ──────────────────────────────────────────────────────────────
let iapReady = false;
let listenerSet = false;

async function ensureIAP() {
  if (USE_MOCK) return;
  if (iapReady) return;

  try {
    await IAP.connectAsync(); // types in Expo SDK return void; an exception will be thrown on failure
  } catch {
    throw new Error('IAP connect failed');
  }

  if (!listenerSet) {
    IAP.setPurchaseListener(async (result) => {
      try {
        if (result.responseCode === IAP.IAPResponseCode.OK && result.results?.length) {
          for (const p of result.results) {
            const pid = p.productId ?? '';
            const ours = (IOS_PRODUCT_IDS as readonly string[]).includes(pid);

            // If Apple confirmed a purchase for our SKUs, flip premium and finish it
            if (ours && (p.transactionReceipt || p.purchaseToken)) {
              const k = keyFor(currentUid);
              proState = true;
              cache.set(k, { loaded: true, pro: true });
              await AsyncStorage.setItem(k, '1');
              notify();

              try {
                await IAP.finishTransactionAsync(p, true);
              } catch {}
            } else {
              // Always finish unknown/stale purchases to keep the queue clean
              try {
                await IAP.finishTransactionAsync(p, true);
              } catch {}
            }
          }
        }
      } catch {
        // ignore listener errors
      }
    });
    listenerSet = true;
  }

  iapReady = true;
}

// ──────────────────────────────────────────────────────────────
// Hook: offerings + entitlement for the *passed* UID
// ──────────────────────────────────────────────────────────────
export function usePro(uid?: string | null) {
  const [hasPro, setHasProLocal] = useState<boolean>(proState);
  const [loading, setLoading] = useState<boolean>(!loaded);
  const [offerings, setOfferings] = useState<Offerings | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      await setCurrentSubscriptionsUser(uid ?? null);

      if (USE_MOCK) {
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

        // 1) Load products
        const { responseCode, results } = await IAP.getProductsAsync(
          IOS_PRODUCT_IDS as unknown as string[]
        );

        if (responseCode === IAP.IAPResponseCode.OK && results?.length) {
          const monthly = results.find((r) => r.productId === 'lp_premium_monthly');
          const annual = results.find((r) => r.productId === 'lp_premium_yearly');
          setOfferings({
            monthly: monthly ? { identifier: monthly.productId, priceString: monthly.price } : undefined,
            annual: annual ? { identifier: annual.productId, priceString: annual.price } : undefined,
          });
        } else {
          setOfferings(null); // store not ready → keep CTA disabled
        }

        // 2) Lightweight restore on mount (marks premium if any prior purchase exists)
        const hist = await IAP.getPurchaseHistoryAsync({ useGooglePlayCache: false }).catch(() => null);
        const anyActive =
          !!hist?.results?.some((p) =>
            (IOS_PRODUCT_IDS as readonly string[]).includes(p.productId ?? '')
          ) || proState;

        proState = anyActive;
        setHasProLocal(anyActive);
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

// ──────────────────────────────────────────────────────────────
// Actions
// ──────────────────────────────────────────────────────────────
export async function purchase(o: Offering): Promise<boolean> {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 400));
    const k = keyFor(currentUid);
    proState = true;
    cache.set(k, { loaded: true, pro: true });
    await AsyncStorage.setItem(k, '1');
    notify();
    return true;
  }

  await ensureIAP();
  // Presents the Apple purchase sheet
  await IAP.purchaseItemAsync(o.identifier);
  // The entitlement flips in the purchase listener after Apple confirms.
  return proState;
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

  // iOS “restore”: check purchase history for our SKUs
  const hist = await IAP.getPurchaseHistoryAsync({ useGooglePlayCache: false }).catch(() => null);
  const active = !!hist?.results?.some((p) =>
    (IOS_PRODUCT_IDS as readonly string[]).includes(p.productId ?? '')
  );

  const k = keyFor(currentUid);
  proState = active;
  cache.set(k, { loaded: true, pro: active });
  await AsyncStorage.setItem(k, active ? '1' : '0');
  notify();
  return active;
}

// Handy for local testing from a dev menu, optional:
export async function _debugResetPro() {
  const k = keyFor(currentUid);
  proState = false;
  cache.set(k, { loaded: true, pro: false });
  await AsyncStorage.setItem(k, '0');
  notify();
}