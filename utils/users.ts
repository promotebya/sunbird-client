// utils/users.ts
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';

/**
 * Make sure /users/{uid} exists.
 * If it doesn't, create a minimal doc used by rules & pair logic.
 */
export async function ensureUserDoc(uid: string) {
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    await setDoc(ref, {
      pairId: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return;
  }

  // Keep an "updatedAt" heartbeat so rules depending on existence never break.
  try {
    await updateDoc(ref, { updatedAt: serverTimestamp() });
  } catch {
    // no-op: if no permission for update, it's fine; existence is enough
  }
}
