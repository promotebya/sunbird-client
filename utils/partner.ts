// utils/partner.ts
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/firebaseConfig';

/**
 * Reads the partnerUid from /users/{uid}.
 * Pass a uid or omit to use the currently logged-in user.
 * Returns the partner's uid or null if none.
 */
export async function getPartnerUid(uid?: string): Promise<string | null> {
  const effectiveUid = uid ?? auth.currentUser?.uid ?? null;
  if (!effectiveUid) return null;

  const ref = doc(db, 'users', effectiveUid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;

  const data = snap.data() as { partnerUid?: string } | undefined;
  return data?.partnerUid ?? null;
}
