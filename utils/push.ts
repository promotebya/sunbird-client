// utils/push.ts
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { arrayUnion, doc, getDoc, setDoc } from 'firebase/firestore';
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
type ExpoReceiptMap = Record<string, { status: 'ok' | 'error'; message?: string; details?: any }>;

const ANDROID_CHANNEL = 'messages';

export async function ensurePushSetup(uid: string) {
  if (!uid) return null;

  // Ask permission
  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== 'granted') {
    const req = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: true, allowSound: true } as any,
    } as any);
    status = req.status;
  }
  if (status !== 'granted') return null;

  // Android channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL, {
      name: 'Messages',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    }).catch(() => {});
  }

  // Get Expo token (needs EAS projectId in app.json)
  const projectId =
    (Constants as any)?.expoConfig?.extra?.eas?.projectId ||
    (Constants as any)?.easConfig?.projectId;
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  if (!token) return null;

  // Save under users/{uid}/public/push so partner can read (per rules)
  const ref = doc(db, 'users', uid, 'public', 'push');
  await setDoc(
    ref,
    { expoPushTokens: arrayUnion(token), updatedAt: new Date() },
    { merge: true }
  );

  console.log('[push] Registered token (public/push):', token);
  return token;
}

/** Read tokens from users/{uid}/public/push (rules allow partner reads). */
export async function getUserExpoTokens(uid: string): Promise<string[]> {
  const snap = await getDoc(doc(db, 'users', uid, 'public', 'push'));
  if (!snap.exists()) return [];
  const arr = Array.isArray((snap.data() as any)?.expoPushTokens)
    ? ((snap.data() as any).expoPushTokens as string[])
    : [];
  return arr.filter((t) => typeof t === 'string' && t.startsWith('ExponentPushToken'));
}

async function sendExpoPush(messages: ExpoMessage[]) {
  const res = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(messages),
  });

  const json = (await res.json()) as ExpoSendResponse;
  if (!res.ok) {
    console.warn('[push] send HTTP error', res.status, json);
    return { tickets: [], receipts: {} as ExpoReceiptMap };
  }

  const tickets: ExpoTicket[] = json?.data ?? [];
  const ids = tickets.map((t) => t.id).filter(Boolean) as string[];

  console.log('[push] tickets:', JSON.stringify(tickets, null, 2));

  // Give Expo a moment to generate receipts
  await new Promise((r) => setTimeout(r, 1500));

  let receipts: ExpoReceiptMap = {};
  if (ids.length) {
    try {
      const r = await fetch('https://exp.host/--/api/v2/push/getReceipts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ ids }),
      });
      const jr = await r.json();
      receipts = (jr?.data ?? {}) as ExpoReceiptMap;
      console.log('[push] receipts:', JSON.stringify(receipts, null, 2));
    } catch (e) {
      console.warn('[push] receipt fetch failed', e);
    }
  }

  return { tickets, receipts };
}

/** Helper to send a single text notification to many tokens (Android channel optional). */
export async function sendToTokens(
  tokens: string[],
  opts: { title: string; body: string; data?: any; channelId?: string }
) {
  if (!tokens.length) return { tickets: [], receipts: {} };

  const messages: ExpoMessage[] = tokens.map((to) => ({
    to,
    sound: 'default',
    title: opts.title,
    body: opts.body,
    data: opts.data,
    channelId: opts.channelId ?? ANDROID_CHANNEL, // must match registered channel on Android
  }));

  return sendExpoPush(messages);
}