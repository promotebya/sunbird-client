import {
    collection,
    doc,
    getDoc,
    getDocs,
    limit,
    query,
    where,
} from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';

/**
 * Return the *other* user's uid that is coupled with the given uid.
 * Tries several known shapes:
 * - partners/{uid} with partnerId: string
 * - partners/{uid} with users: [uidA, uidB]
 * - partners/{uid} with pairId -> pairs/{pairId}.users: [uidA, uidB]
 * - couples (or pairs) collection where users array-contains uid
 */
export async function getPartnerUid(uid: string): Promise<string | null> {
  if (!uid) return null;

  // 1) partners/{uid}
  try {
    const pRef = doc(db, 'partners', uid);
    const pSnap = await getDoc(pRef);
    if (pSnap.exists()) {
      const d = pSnap.data() as any;

      if (typeof d?.partnerId === 'string' && d.partnerId) {
        return d.partnerId;
      }

      if (Array.isArray(d?.users)) {
        const other = (d.users as string[]).find((u) => u && u !== uid);
        if (other) return other;
      }

      if (typeof d?.pairId === 'string' && d.pairId) {
        const pairDoc = await getDoc(doc(db, 'pairs', d.pairId));
        if (pairDoc.exists()) {
          const pd = pairDoc.data() as any;
          if (Array.isArray(pd?.users)) {
            const other = (pd.users as string[]).find((u) => u && u !== uid);
            if (other) return other;
          }
        }
      }
    }
  } catch (e) {
    // non-fatal, we’ll try other shapes
    console.warn('getPartnerUid: partners/{uid} path failed:', e);
  }

  // 2) couples collection (users array)
  try {
    const q1 = query(
      collection(db, 'couples'),
      where('users', 'array-contains', uid),
      limit(1)
    );
    const s1 = await getDocs(q1);
    if (!s1.empty) {
      const d = s1.docs[0].data() as any;
      if (Array.isArray(d?.users)) {
        const other = (d.users as string[]).find((u) => u && u !== uid);
        if (other) return other;
      }
    }
  } catch (e) {
    console.warn('getPartnerUid: couples path failed:', e);
  }

  // 3) pairs collection (users array)
  try {
    const q2 = query(
      collection(db, 'pairs'),
      where('users', 'array-contains', uid),
      limit(1)
    );
    const s2 = await getDocs(q2);
    if (!s2.empty) {
      const d = s2.docs[0].data() as any;
      if (Array.isArray(d?.users)) {
        const other = (d.users as string[]).find((u) => u && u !== uid);
        if (other) return other;
      }
    }
  } catch (e) {
    console.warn('getPartnerUid: pairs path failed:', e);
  }

  return null;
}

/**
 * Optional helper if you ever need the user's pairId quickly.
 * Tries partners/{uid}.pairId, then first couples/pairs doc that contains uid.
 */
export async function getPairIdForUser(uid: string): Promise<string | null> {
  if (!uid) return null;

  // partners/{uid}.pairId
  try {
    const pRef = doc(db, 'partners', uid);
    const pSnap = await getDoc(pRef);
    if (pSnap.exists()) {
      const d = pSnap.data() as any;
      if (typeof d?.pairId === 'string' && d.pairId) return d.pairId;
    }
  } catch {}

  // couples
  try {
    const q1 = query(
      collection(db, 'couples'),
      where('users', 'array-contains', uid),
      limit(1)
    );
    const s1 = await getDocs(q1);
    if (!s1.empty) return s1.docs[0].id;
  } catch {}

  // pairs
  try {
    const q2 = query(
      collection(db, 'pairs'),
      where('users', 'array-contains', uid),
      limit(1)
    );
    const s2 = await getDocs(q2);
    if (!s2.empty) return s2.docs[0].id;
  } catch {}

  return null;
}
