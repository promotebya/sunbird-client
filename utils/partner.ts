// utils/partner.ts
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';

/**
 * Reads /users/{uid} and returns data.partnerUid (or null)
 */
export async function getPartnerUid(uid: string): Promise<string | null> {
  if (!uid) return null;

  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;

  const data = snap.data() as { partnerUid?: string | null };
  return data?.partnerUid ?? null;
}
