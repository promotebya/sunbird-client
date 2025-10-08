// utils/registerPushToken.ts
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { doc, setDoc } from 'firebase/firestore';
import { Platform } from 'react-native';
import { db } from '../firebaseConfig';

export async function registerPushTokenForUser(userId: string) {
  // Ask for permissions (Android 13+ needs POST_NOTIFICATIONS which you added in app.json)
  const settings = await Notifications.getPermissionsAsync();
  let status = settings.status;
  if (status !== 'granted') {
    const req = await Notifications.requestPermissionsAsync();
    status = req.status;
  }
  if (status !== 'granted') return null;

  // IMPORTANT: pass projectId when getting the Expo token (SDK 49+)
  const projectId =
    Constants?.expoConfig?.extra?.eas?.projectId ||
    Constants?.easConfig?.projectId;

  const token = (
    await Notifications.getExpoPushTokenAsync({ projectId })
  ).data;

  // Save on the user doc (merge keeps other fields)
  await setDoc(
    doc(db, 'users', userId),
    { expoPushToken: token, expoPushTokenUpdatedAt: new Date() },
    { merge: true }
  );

  // Create a default Android channel once (for local + remote notifications)
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.DEFAULT
    }).catch(() => {});
  }

  return token;
}