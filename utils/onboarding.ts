// utils/onboarding.ts
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';

export async function getTipsDismissed(uid: string): Promise<boolean> {
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  const data = snap.exists() ? (snap.data() as any) : {};
  return !!data?.onboarding?.tipsDismissed;
}

export async function setTipsDismissed(uid: string, value: boolean) {
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, { onboarding: { tipsDismissed: value } }, { merge: true });
  } else {
    await updateDoc(ref, { onboarding: { tipsDismissed: value } });
  }
}
