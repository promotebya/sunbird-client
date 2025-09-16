// utils/settings.ts
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';

export type UserPrefs = {
  allowPush?: boolean;
  theme?: 'system' | 'light' | 'dark';
};

export async function getUserPrefs(uid: string): Promise<UserPrefs> {
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return {};
  const d = snap.data() as any;
  return {
    allowPush: Boolean(d.allowPush),
    theme: (d.theme ?? 'system') as UserPrefs['theme'],
  };
}

export async function saveUserPrefs(uid: string, prefs: UserPrefs) {
  const ref = doc(db, 'users', uid);
  await setDoc(
    ref,
    {
      ...prefs,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}
