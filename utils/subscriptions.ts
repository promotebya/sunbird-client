// utils/subscriptions.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import Purchases, {
  CustomerInfo,
  PurchasesStoreProduct,
} from 'react-native-purchases';

// ───────────────────────────────────────────────────────────────────────────────
// CONFIG
// ───────────────────────────────────────────────────────────────────────────────

// Use mocks only in development; real StoreKit/RevenueCat in release.
const USE_MOCK = __DEV__;

// Your iOS product IDs (must match App Store Connect exactly).
export const IOS_PRODUCT_IDS = ['lp_premium_monthly', 'lp_premium_yearly'] as const;

// Optional Android product IDs (keep for parity later)
// export const ANDROID_PRODUCT_IDS = ['lp_premium_monthly', 'lp_premium_yearly'] as const;

// Public RC API keys via app.json -> expo.extra / EXPO_PUBLIC_* envs
const RC_IOS_KEY = process.env.EXPO_PUBLIC_RC_IOS_KEY ?? '';
const RC_ANDROID_KEY = process.env.EXPO_PUBLIC_RC_ANDROID_KEY ?? '';

// ───────────────────────────────────────────────────────────────────────────────
// TYPES
// ───────────────────────────────────────────────────────────────────────────────

export type Offering = { identifier: string; priceString: string };
export type Offerings = { monthly?: Offering; annual?: Offering };

/** Storage key scoped by UID so Premium is per-account (not per-device). */
const keyFor = (uid: string | null | undefined) =>
  `lp:pro_entitlement:${uid ?? 'anon'}`;

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

  // Keep RevenueCat identity in sync (best effort, non-blocking)
  if (!USE_MOCK) {
    try {
      await ensureRC();
      if (currentUid) await Purchases.logIn(currentUid);
      else await Purchases.logOut();
    } catch {
      // ignore
    }
  }
}

// ───────────────────────────────────────────────────────────────────────────────
// RevenueCat bootstrap
// ───────────────────────────────────────────────────────────────────────────────

let rcConfigured = false;

async function ensureRC() {
  if (rcConfigured) return;

  const apiKey =
    Platform.OS === 'ios' ? RC_IOS_KEY : RC_ANDROID_KEY;

  if (!apiKey) {
    throw new Error(
      `RevenueCat API key missing for ${Platform.OS}. Set EXPO_PUBLIC_RC_IOS_KEY/EXPO_PUBLIC_RC_ANDROID_KEY.`
    );
  }

  await Purchases.configure({ apiKey });
  if (__DEV__) {
    // Helpful in dev logs; no effect on release.
    try {
      // @ts-ignore older types
      Purchases.setDebugLogsEnabled?.(true);
    } catch {}
  }

  // Keep local state in sync if RC pushes updates (restore/upgrade elsewhere)
  Purchases.addCustomerInfoUpdateListener((info) => {
    const active = hasActive(info);
    const k = keyFor(currentUid);
    proState = active;
    cache.set(k, { loaded: true, pro: active });
    AsyncStorage.setItem(k, active ? '1' : '0').finally(() => notify());
  });

  rcConfigured = true;
}

function hasActive(info: CustomerInfo) {
  // Easiest cross-project check without defining entitlements in RC:
  const subs = info.activeSubscriptions ?? [];
  return subs.includes('lp_premium_monthly') || subs.includes('lp_premium_yearly');
}

function mapProduct(p?: PurchasesStoreProduct): Offering | undefined {
  return p ? { identifier: p.identifier, priceString: p.priceString } : undefined;
}

// ───────────────────────────────────────────────────────────────────────────────
// Hook: offerings + entitlement for the *passed* UID
// ───────────────────────────────────────────────────────────────────────────────

export function usePro(uid?: string | null) {
  const [hasPro, setHasProLocal] = useState<boolean>(proState);
  const [loading, setLoading] = useState<boolean>(!loaded);
  const [offerings, setOfferings] = useState<Offerings | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      await setCurrentSubscriptionsUser(uid ?? null);
      if (!alive) return;

      if (USE_MOCK) {
        // Dev mocks use real product IDs so UI/paywall text matches screenshots.
        setOfferings({
          monthly: { identifier: 'lp_premium_monthly', priceString: '€2.99' },
          annual: { identifier: 'lp_premium_yearly', priceString: '€19.99' },
        });
        setHasProLocal(proState);
        setLoading(false);
        return;
      }

      try {
        await ensureRC();

        // Load products by IDs (keeps pricing localised & screenshot-consistent)
        const ids = IOS_PRODUCT_IDS as unknown as string[];
        const products = await Purchases.getProducts(ids);
        const monthly = products.find((p) => p.identifier === 'lp_premium_monthly');
        const annual = products.find((p) => p.identifier === 'lp_premium_yearly');
        setOfferings({ monthly: mapProduct(monthly), annual: mapProduct(annual) });

        // Get current entitlement
        const info = await Purchases.getCustomerInfo();
        const active = hasActive(info);
        proState = active;
        setHasProLocal(active);
      } catch (err) {
        // If RC fails, keep UI usable but don’t unlock
        setOfferings(null);
      } finally {
        setLoading(false);
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

  // Expose a setter (used by mock purchase/restore only)
  const setHasPro = async (v: boolean) => {
    const k = keyFor(currentUid);
    proState = v;
    cache.set(k, { loaded: true, pro: v });
    await AsyncStorage.setItem(k, v ? '1' : '0');
    notify();
  };

  return { loading, hasPro, setHasPro, offerings };
}

// ───────────────────────────────────────────────────────────────────────────────
// Actions
// ───────────────────────────────────────────────────────────────────────────────

export async function purchase(o: Offering): Promise<boolean> {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 400)); // tiny “store” delay
    const k = keyFor(currentUid);
    proState = true;
    cache.set(k, { loaded: true, pro: true });
    await AsyncStorage.setItem(k, '1');
    notify();
    return true;
  }

  await ensureRC();
  const { customerInfo } = await Purchases.purchaseProduct(o.identifier); // v7 returns MakePurchaseResult
  const active = hasActive(customerInfo);
  const k = keyFor(currentUid);
  proState = active;
  cache.set(k, { loaded: true, pro: active });
  await AsyncStorage.setItem(k, active ? '1' : '0');
  notify();
  return active;
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

  await ensureRC();
  const info = await Purchases.restorePurchases();
  const active = hasActive(info);
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