// utils/push.ts
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { getAuth } from 'firebase/auth';
import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { Platform } from 'react-native';
import { db } from '../firebaseConfig';

type ExpoMessage = {
  to: string;
  sound?: 'default';
  title: string;
  body: string;
  data?: Record<string, any>;
  channelId?: string; // Android channel
  priority?: 'default' | 'normal' | 'high'; // Android hint
  interruptionLevel?: 'active' | 'critical' | 'passive' | 'time-sensitive'; // iOS hint (hyphen)
};

type ExpoTicket = { id?: string; status: 'ok' | 'error'; message?: string; details?: any };
type ExpoSendResponse = { data?: ExpoTicket[]; errors?: any[] };
type ExpoReceipt = { status: 'ok' | 'error'; message?: string; details?: any };
type ExpoReceiptMap = Record<string, ExpoReceipt>;

const ANDROID_CHANNEL = 'messages';

// Foreground behavior — compatible with SDK 53 typings
Notifications.setNotificationHandler({
  handleNotification: async () => {
    const behavior: any = {
      shouldShowAlert: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    };
    if (Platform.OS === 'ios') {
      behavior.shouldShowBanner = true;
      behavior.shouldShowList = true;
    }
    return behavior;
  },
});

/** Map various caller spellings to the Expo-valid values (hyphenated). */
function normalizeInterruptionLevel(
  v?: string
): ExpoMessage['interruptionLevel'] | undefined {
  if (!v) return undefined;
  const s = String(v);
  if (s === 'timeSensitive' || s === 'time-sensitive') return 'time-sensitive';
  if (s === 'active') return 'active';
  if (s === 'passive') return 'passive';
  if (s === 'critical') return 'critical';
  return undefined;
}

/**
 * Register for notifications, create Android channel,
 * and store token to:
 *   - users/{uid}.expoPushTokens (owner-only)
 *   - users/{uid}/public/push.expoPushTokens (partner-readable)
 */
export async function ensurePushSetup(uid: string) {
  if (!uid) return null;

  // Permissions
  let status = (await Notifications.getPermissionsAsync()).status;
  if (status !== 'granted') {
    status = (await Notifications.requestPermissionsAsync()).status;
  }
  if (status !== 'granted') {
    console.warn('[push] permissions not granted; skipping token registration');
    return null;
  }

  // Android channel
  if (Platform.OS === 'android') {
    try {
      await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL, {
        name: 'Messages',
        importance: Notifications.AndroidImportance.DEFAULT,
        sound: 'default',
        vibrationPattern: [0, 200, 150, 200],
        lightColor: '#FF7ABFFF',
      });
    } catch (e) {
      console.warn('[push] setNotificationChannelAsync failed', e);
    }
  }

  // EAS projectId required outside Expo Go
  const projectId =
    (Constants as any)?.expoConfig?.extra?.eas?.projectId ||
    (Constants as any)?.easConfig?.projectId;

  if (!projectId) {
    console.warn('[push] Missing EAS projectId. Add it to app.json/app.config.');
    return null;
  }

  // Get Expo token
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  if (!token) {
    console.warn('[push] getExpoPushTokenAsync returned no token');
    return null;
  }

  // Save token (top-level doc; owner-only)
  const userRef = doc(db, 'users', uid);
  try {
    await setDoc(userRef, { expoPushTokens: [token] }, { merge: true });
    await updateDoc(userRef, { expoPushTokens: arrayUnion(token) });
  } catch (e) {
    console.warn('[push] saving top-level token failed', e);
  }

  // Save token (public/push; partner-readable)
  const publicRef = doc(db, 'users', uid, 'public', 'push');
  const now = new Date();
  try {
    await setDoc(publicRef, { expoPushTokens: [token], updatedAt: now }, { merge: true });
    await updateDoc(publicRef, { expoPushTokens: arrayUnion(token), updatedAt: now });
  } catch (e) {
    console.warn('[push] saving public token failed', e);
  }

  console.log('[push] token registered for', uid, ':', token);
  return token;
}

/**
 * One-shot migration: if you ever only had tokens at /users/{uid}.expoPushTokens,
 * copy them into /users/{uid}/public/push so partners (same pair) can read them.
 */
export async function migrateMyTokensToPublic() {
  const me = getAuth().currentUser?.uid;
  if (!me) return;

  try {
    const topSnap = await getDoc(doc(db, 'users', me));
    if (!topSnap.exists()) return;
    const arr = (topSnap.data() as any)?.expoPushTokens;
    if (!Array.isArray(arr) || !arr.length) return;

    const publicRef = doc(db, 'users', me, 'public', 'push');
    await setDoc(
      publicRef,
      {
        expoPushTokens: arrayUnion(...arr),
        updatedAt: new Date(),
      },
      { merge: true }
    );
    console.log('[push] migrated', arr.length, 'tokens to public for', me);
  } catch (e) {
    console.warn('[push] migrateMyTokensToPublic failed', e);
  }
}

/**
 * Return Expo tokens for a user.
 * - For OTHER users: only read `/users/{uid}/public/push` (rules allow same-pair read)
 * - For SELF: also read `/users/{uid}` to include any legacy tokens
 */
export async function getUserExpoTokens(uid: string): Promise<string[]> {
  const me = getAuth().currentUser?.uid ?? null;
  const tokens: string[] = [];
  let pubCount = 0;
  let topCount = 0;

  try {
    const pubSnap = await getDoc(doc(db, 'users', uid, 'public', 'push'));
    if (pubSnap.exists()) {
      const arr = (pubSnap.data() as any)?.expoPushTokens;
      if (Array.isArray(arr)) {
        tokens.push(...arr);
        pubCount = arr.length;
      }
    }
  } catch (e) {
    console.warn('[push] read public tokens failed for', uid, e);
  }

  if (me && me === uid) {
    try {
      const topSnap = await getDoc(doc(db, 'users', uid));
      if (topSnap.exists()) {
        const arr = (topSnap.data() as any)?.expoPushTokens;
        if (Array.isArray(arr)) {
          tokens.push(...arr);
          topCount = arr.length;
        }
      }
    } catch (e) {
      console.warn('[push] read top-level tokens failed for', uid, e);
    }
  }

  const uniq = Array.from(new Set(tokens)).filter(
    (t) =>
      typeof t === 'string' &&
      (t.startsWith('ExponentPushToken') || t.startsWith('ExpoPushToken'))
  );

  console.log(
    `[push] tokens for ${uid}: total=${uniq.length} (public=${pubCount}${me === uid ? `, top=${topCount}` : ''})`
  );
  if (!uniq.length) console.warn('[push] no tokens found for uid', uid);
  return uniq;
}

/** Internal: chunk helper */
function chunk<T>(arr: T[], size = 99) {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function postMessages(payload: any) {
  const res = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
  });
  let json: ExpoSendResponse;
  try {
    json = (await res.json()) as ExpoSendResponse;
  } catch {
    json = { errors: [{ message: 'Non-JSON response' } as any] };
  }
  return { res, json };
}

async function sendExpoPush(messages: ExpoMessage[]) {
  const tickets: ExpoTicket[] = [];
  const receiptIds: string[] = [];

  // Send in chunks (Expo recommends <= 100 per call)
  for (const group of chunk(messages, 99)) {
    let { res, json } = await postMessages(group);

    // Fallback: some environments complain "Expected object, received array".
    if (!res.ok && Array.isArray(group) && String(json?.errors?.[0]?.message || '').includes('Expected object')) {
      for (const m of group) {
        const single = await postMessages(m);
        if (!single.res.ok) {
          console.warn('[push] HTTP error (single):', single.res.status, single.json);
        }
        const tix = single.json?.data ?? [];
        tickets.push(...tix);
        receiptIds.push(...tix.map((t: any) => t.id).filter(Boolean) as string[]);
      }
      continue;
    }

    const groupTickets = json?.data ?? [];
    tickets.push(...groupTickets);
    receiptIds.push(...groupTickets.map((t) => t.id).filter(Boolean) as string[]);

    if (!res.ok) {
      console.warn('[push] HTTP error sending chunk:', res.status, json);
    }
  }

  // Fetch receipts
  await new Promise((r) => setTimeout(r, 1200));

  const receipts: ExpoReceiptMap = {};
  for (const idGroup of chunk(receiptIds, 300)) {
    try {
      const r = await fetch('https://exp.host/--/api/v2/push/getReceipts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ ids: idGroup }),
      });
      const jr = await r.json();
      Object.assign(receipts, (jr?.data ?? {}) as ExpoReceiptMap);
    } catch (e) {
      console.warn('[push] receipt fetch failed:', e);
    }
  }

  return { tickets, receipts };
}

/** Send one text notification to many tokens. */
export async function sendToTokens(
  tokens: string[],
  opts: {
    title: string;
    body: string;
    data?: any;
    channelId?: string;
    priority?: 'default' | 'normal' | 'high';
    interruptionLevel?: 'active' | 'critical' | 'passive' | 'timeSensitive' | 'time-sensitive';
  }
) {
  if (!tokens.length) {
    console.warn('[push] sendToTokens: no tokens — skipping send');
    return { tickets: [], receipts: {} as ExpoReceiptMap };
  }

  const il = normalizeInterruptionLevel(opts.interruptionLevel);

  const messages: ExpoMessage[] = tokens.map((to) => ({
    to,
    sound: 'default',
    title: opts.title,
    body: opts.body,
    data: opts.data,
    channelId: opts.channelId ?? ANDROID_CHANNEL,
    priority: opts.priority ?? 'high',
    ...(il ? { interruptionLevel: il } : null),
  }));

  console.log('[push] sending', messages.length, 'message(s)');
  return sendExpoPush(messages);
}

/** Optional backend handoff to a Cloud Function if you add one later. */
export async function enqueueRewardRedeemedPush(params: {
  toUid: string;
  pairId?: string | null;
  actorName?: string | null;
  rewardTitle: string;
  scope: 'shared' | 'personal';
}) {
  const { toUid, pairId = null, actorName, rewardTitle, scope } = params;
  try {
    await addDoc(collection(db, 'pushOutbox'), {
      type: 'reward_redeemed',
      toUid,
      pairId,
      title: 'Reward redeemed',
      body: `${actorName || 'Your partner'} redeemed “${rewardTitle}”${scope === 'personal' ? ' (personal)' : ''}.`,
      data: { pairId, rewardTitle, scope },
      status: 'pending',
      createdAt: serverTimestamp(),
    });
  } catch (e) {
    console.warn('[push] enqueue pushOutbox failed:', e);
  }
}