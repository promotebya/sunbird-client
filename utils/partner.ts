// utils/partner.ts
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';

/** Returns the partner's UID stored on users/{uid}.partnerUid, or null. */
export async function getPartnerUid(uid: string): Promise<string | null> {
  if (!uid) return null;
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const data = snap.data() as { partnerUid?: string | null };
  return data?.partnerUid ?? null;
}

/** Returns the pairId stored on users/{uid}.pairId (deterministic, e.g., uidA_uidB), or null. */
export async function getPairId(uid: string): Promise<string | null> {
  if (!uid) return null;
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const data = snap.data() as { pairId?: string | null };
  return data?.pairId ?? null;
}
