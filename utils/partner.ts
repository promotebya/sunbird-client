import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';

export async function getPartnerUid(uid: string | undefined | null): Promise<string | null> {
  if (!uid) return null;
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const data = snap.data() as { partnerUid?: string | null };
  return data?.partnerUid ?? null;
}
