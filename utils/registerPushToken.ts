// utils/registerPushToken.ts
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { doc, setDoc } from 'firebase/firestore';
import { Platform } from 'react-native';
import { db } from '../firebaseConfig';

export async function registerPushTokenForUser(userId: string) {
  // Ask for permissions (Android 13+ needs POST_NOTIFICATIONS in app.json)
  const current = await Notifications.getPermissionsAsync();
  let status = current.status;
  if (status !== 'granted') {
    const req = await Notifications.requestPermissionsAsync();
    status = req.status;
  }
  if (status !== 'granted') return null;

  // IMPORTANT: pass projectId on SDK 49+
  const projectId =
    (Constants?.expoConfig as any)?.extra?.eas?.projectId ||
    (Constants as any)?.easConfig?.projectId;

  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;

  // Save/merge on user doc
  await setDoc(
    doc(db, 'users', userId),
    { expoPushToken: token, expoPushTokenUpdatedAt: new Date() },
    { merge: true }
  );

  // Ensure Android channel exists for local/remote
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: 'default',
    }).catch(() => {});
  }

  return token;
}