// utils/push.ts
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { addDoc, collection, getDocs, query, serverTimestamp, where } from 'firebase/firestore';
import { Platform } from 'react-native';
import { db } from '../firebaseConfig';

export async function registerForPushTokensAsync(uid: string) {
  if (!uid) return null;

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== 'granted') {
    const req = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: false,
        allowSound: true,
      },
    } as any);
    status = req.status;
  }
  if (status !== 'granted') return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    }).catch(() => {});
  }

  const projectId =
    (Constants.expoConfig?.extra as any)?.eas?.projectId ??
    (Constants.easConfig as any)?.projectId;

  const { data: expoPushToken } = await Notifications.getExpoPushTokenAsync({ projectId });
  if (!expoPushToken) return null;

  // de-dupe
  const q = query(collection(db, 'users', uid, 'pushTokens'), where('token', '==', expoPushToken));
  const existingDocs = await getDocs(q);
  if (existingDocs.empty) {
    await addDoc(collection(db, 'users', uid, 'pushTokens'), {
      token: expoPushToken,
      platform: Platform.OS,
      createdAt: serverTimestamp(),
    });
  }

  return expoPushToken;
}

// Optional: manual test
export async function sendPushToToken({ to, title, body, data }: { to: string; title: string; body: string; data?: any; }) {
  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to, title, body, data, sound: 'default', priority: 'high' }),
  });
}