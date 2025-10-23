// utils/push.ts
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
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
};

type ExpoTicket = { id?: string; status: 'ok' | 'error'; message?: string; details?: any };
type ExpoSendResponse = { data?: ExpoTicket[]; errors?: any[] };
type ExpoReceipt = { status: 'ok' | 'error'; message?: string; details?: any };
type ExpoReceiptMap = Record<string, ExpoReceipt>;

const ANDROID_CHANNEL = 'messages';

// Foreground behavior — keep it subtle, but satisfy newer typings too
Notifications.setNotificationHandler({
  handleNotification: async () => {
    // Use `any` so this works across expo-notifications 0.31 .. 0.4x
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

/**
 * Registers for notifications, creates Android channel, fetches Expo token,
 * and stores the token under:
 *   - users/{uid}.expoPushTokens
 *   - users/{uid}/public/push.expoPushTokens  (partner-readable)
 */
export async function ensurePushSetup(uid: string) {
  if (!uid) return null;

  // Permissions
  let status = (await Notifications.getPermissionsAsync()).status;
  if (status !== 'granted') {
    status = (await Notifications.requestPermissionsAsync()).status;
  }
  if (status !== 'granted') return null;

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
    } catch {}
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
  if (!token) return null;

  // Save token (top-level doc)
  const userRef = doc(db, 'users', uid);
  await setDoc(userRef, { expoPushTokens: [token] }, { merge: true });
  await updateDoc(userRef, { expoPushTokens: arrayUnion(token) });

  // Save token (public/push)
  const publicRef = doc(db, 'users', uid, 'public', 'push');
  const now = new Date();
  await setDoc(publicRef, { expoPushTokens: [token], updatedAt: now }, { merge: true });
  await updateDoc(publicRef, { expoPushTokens: arrayUnion(token), updatedAt: now });

  console.log('[push] token registered:', token);
  return token;
}

/** Returns all known Expo tokens for a user from both storage locations. */
export async function getUserExpoTokens(uid: string): Promise<string[]> {
  const topSnap = await getDoc(doc(db, 'users', uid));
  const pubSnap = await getDoc(doc(db, 'users', uid, 'public', 'push'));

  const fromTop = (topSnap.exists() && (topSnap.data() as any).expoPushTokens) || [];
  const fromPub = (pubSnap.exists() && (pubSnap.data() as any).expoPushTokens) || [];

  const all = [...fromTop, ...fromPub].filter(Boolean);
  const uniq = Array.from(new Set(all)).filter((t: string) =>
    typeof t === 'string' && (t.startsWith('ExponentPushToken') || t.startsWith('ExpoPushToken'))
  );
  return uniq;
}

/** Internal: chunk helper */
function chunk<T>(arr: T[], size = 99) {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function sendExpoPush(messages: ExpoMessage[]) {
  const tickets: ExpoTicket[] = [];
  const receiptIds: string[] = [];

  // Send in chunks (Expo recommends <= 100 per call)
  for (const group of chunk(messages, 99)) {
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(group),
    });

    const json = (await res.json()) as ExpoSendResponse;
    const groupTickets = json?.data ?? [];
    tickets.push(...groupTickets);
    receiptIds.push(...groupTickets.map((t) => t.id).filter(Boolean) as string[]);

    if (!res.ok) {
      console.warn('[push] HTTP error sending chunk:', res.status, json);
    }
  }

  // Brief wait, then fetch receipts in chunks
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
  opts: { title: string; body: string; data?: any; channelId?: string }
) {
  if (!tokens.length) return { tickets: [], receipts: {} as ExpoReceiptMap };

  const messages: ExpoMessage[] = tokens.map((to) => ({
    to,
    sound: 'default',
    title: opts.title,
    body: opts.body,
    data: opts.data,
    channelId: opts.channelId ?? ANDROID_CHANNEL, // must match Android channel
  }));

  return sendExpoPush(messages);
}

/**
 * Optional backend handoff (if you wire a Cloud Function to process `pushOutbox`).
 */
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