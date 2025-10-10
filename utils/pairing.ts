// utils/pairing.ts
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';

// 30 minutes validity
const EXPIRY_MINUTES = 30;

function randomCode(): string {
  // 6-digit numeric (easy to share)
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function expiryFromNow(minutes = EXPIRY_MINUTES) {
  const d = new Date();
  d.setMinutes(d.getMinutes() + minutes);
  return d;
}

/** Clean up any expired, unused codes for this user. */
export async function purgeMyExpiredPairCodes(ownerUid: string) {
  if (!ownerUid) return;

  const qy = query(
    collection(db, 'pairCodes'),
    where('ownerUid', '==', ownerUid),
    where('used', '==', false)
  );
  const snap = await getDocs(qy);
  const now = Date.now();

  for (const d of snap.docs) {
    const data = d.data() as { expiresAt?: string | null };
    const exp = data?.expiresAt ? new Date(data.expiresAt).getTime() : 0;
    if (exp && exp < now) {
      await deleteDoc(d.ref).catch(() => {});
    }
  }

  // Best-effort clear stale reference on the user doc
  try {
    await updateDoc(doc(db, 'users', ownerUid), {
      pairCode: null,
      pairCodeExpiresAt: null,
      updatedAt: serverTimestamp(),
    });
  } catch {}
}

export type PairCodeInfo = { code: string; expiresAtISO: string };

/** Returns the active (non-expired) code stored on the user, if any. */
export async function getMyActivePairCode(ownerUid: string): Promise<PairCodeInfo | null> {
  if (!ownerUid) return null;
  const usnap = await getDoc(doc(db, 'users', ownerUid));
  if (!usnap.exists()) return null;
  const u = usnap.data() as any;
  const code: string | null = u?.pairCode ?? null;
  const expiresAtISO: string | null = u?.pairCodeExpiresAt ?? null;
  if (!code || !expiresAtISO) return null;
  const exp = new Date(expiresAtISO).getTime();
  if (isNaN(exp) || exp <= Date.now()) return null;
  return { code, expiresAtISO };
}

/** Generate a single-use code your partner can redeem. */
export async function generatePairCode(ownerUid: string): Promise<PairCodeInfo> {
  if (!ownerUid) throw new Error('Missing ownerUid');

  await purgeMyExpiredPairCodes(ownerUid);

  for (let i = 0; i < 5; i++) {
    const code = randomCode();
    const ref = doc(db, 'pairCodes', code);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      const expiresAtISO = expiryFromNow().toISOString();
      await setDoc(ref, {
        ownerUid,
        createdAt: serverTimestamp(),
        expiresAt: expiresAtISO,
        used: false,
      });
      // convenience
      await updateDoc(doc(db, 'users', ownerUid), {
        pairCode: code,
        pairCodeExpiresAt: expiresAtISO,
        updatedAt: serverTimestamp(),
      }).catch(() => {});
      return { code, expiresAtISO };
    }
  }
  throw new Error('Could not generate code. Please try again.');
}

/**
 * Redeem a partner’s code and link both accounts.
 *
 * IMPORTANT: No reads of the partner’s /users doc (your rules forbid that).
 * We do a single batch that:
 *   - upserts /pairs/{pairId}
 *   - sets (merge) my user with partnerUid/pairId and clears my pairCode*
 *   - sets (merge) partner user with ONLY partnerUid/pairId (no updatedAt, no code fields)
 *   - deletes /pairCodes/{code}
 */
export async function redeemPairCode(myUid: string, code: string): Promise<{ partnerUid: string; pairId: string }> {
  if (!myUid || !code) throw new Error('Missing uid or code');

  const codeRef = doc(db, 'pairCodes', code);
  const codeSnap = await getDoc(codeRef);
  if (!codeSnap.exists()) throw new Error('Invalid or expired code');

  const data = codeSnap.data() as { ownerUid?: string; expiresAt?: string; used?: boolean };
  if (!data?.ownerUid) throw new Error('Invalid code');
  if (data.used) throw new Error('Code already used');
  if (data.ownerUid === myUid) throw new Error('You cannot link with yourself');

  if (data.expiresAt) {
    const isExpired = new Date(data.expiresAt).getTime() < Date.now();
    if (isExpired) throw new Error('Code expired');
  }

  const partnerUid = data.ownerUid;
  const pairId = [myUid, partnerUid].sort().join('_');

  const batch = writeBatch(db);

  // Upsert pair
  batch.set(
    doc(db, 'pairs', pairId),
    { members: [myUid, partnerUid], createdAt: serverTimestamp() },
    { merge: true }
  );

  // My user — allowed freely (isSelf). Also clear any visible invite code fields.
  batch.set(
    doc(db, 'users', myUid),
    {
      partnerUid,
      pairId,
      pairCode: null,
      pairCodeExpiresAt: null,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  // Partner user — rule only lets us change pairId & partnerUid (no updatedAt/other keys).
  batch.set(
    doc(db, 'users', partnerUid),
    {
      partnerUid: myUid,
      pairId,
    } as any,
    { merge: true }
  );

  // One-time use
  batch.delete(codeRef);

  await batch.commit();

  // Best-effort: hard delete the code doc if still present (race safe)
  try {
    await deleteDoc(codeRef);
  } catch {}

  return { partnerUid, pairId };
}