// utils/pairing.ts
import {
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    query,
    runTransaction,
    serverTimestamp,
    setDoc,
    updateDoc,
    where,
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

/** Purge any unused + expired codes owned by this user. Safe to call anytime. */
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

  // Also clear any stale code reference on the user doc (best-effort)
  try {
    const uref = doc(db, 'users', ownerUid);
    const usnap = await getDoc(uref);
    if (usnap.exists()) {
      const u = usnap.data() as any;
      const userExp = u?.pairCodeExpiresAt ? new Date(u.pairCodeExpiresAt).getTime() : 0;
      if (userExp && userExp < now) {
        await updateDoc(uref, { pairCode: null, pairCodeExpiresAt: null, updatedAt: serverTimestamp() });
      }
    }
  } catch {}
}

export type PairCodeInfo = { code: string; expiresAtISO: string };

/** Return the currently active (non-expired) code stored on the user doc, if any. */
export async function getMyActivePairCode(ownerUid: string): Promise<PairCodeInfo | null> {
  if (!ownerUid) return null;
  const uref = doc(db, 'users', ownerUid);
  const usnap = await getDoc(uref);
  if (!usnap.exists()) return null;
  const u = usnap.data() as any;
  const code: string | null = u?.pairCode ?? null;
  const expiresAtISO: string | null = u?.pairCodeExpiresAt ?? null;
  if (!code || !expiresAtISO) return null;
  const exp = new Date(expiresAtISO).getTime();
  if (isNaN(exp) || exp <= Date.now()) return null;
  return { code, expiresAtISO };
}

/**
 * Create a single-use code other users can redeem to link with you.
 * - Writes to /pairCodes/{code} with ownerUid + expiry
 * - Returns { code, expiresAtISO }
 */
export async function generatePairCode(ownerUid: string): Promise<PairCodeInfo> {
  if (!ownerUid) throw new Error('Missing ownerUid');

  // Clean up stale codes first
  await purgeMyExpiredPairCodes(ownerUid);

  // Try a few times in case of collision
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
      // Also store on user (optional convenience)
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
 * Redeem a partner's code and link both accounts.
 * - Validates expiry & ownership
 * - Writes partnerUid on both users and a shared pairId
 * - Marks/revokes the code
 */
export async function redeemPairCode(myUid: string, code: string): Promise<{ partnerUid: string; pairId: string }> {
  if (!myUid || !code) throw new Error('Missing uid or code');

  const codeRef = doc(db, 'pairCodes', code);

  return await runTransaction(db, async (tx) => {
    const codeSnap = await tx.get(codeRef);
    if (!codeSnap.exists()) throw new Error('Invalid code');

    const data = codeSnap.data() as { ownerUid: string; expiresAt?: string; used?: boolean };
    if (data.used) throw new Error('Code already used');
    if (data.ownerUid === myUid) throw new Error('You cannot link with yourself');

    // expiry check
    if (data.expiresAt) {
      const isExpired = new Date(data.expiresAt).getTime() < Date.now();
      if (isExpired) throw new Error('Code expired');
    }

    const partnerUid = data.ownerUid;

    // Optional: block if either already linked
    const myRef = doc(db, 'users', myUid);
    const partnerRef = doc(db, 'users', partnerUid);
    const mySnap = await tx.get(myRef);
    const partnerSnap = await tx.get(partnerRef);

    const myData = mySnap.exists() ? (mySnap.data() as any) : {};
    const partnerData = partnerSnap.exists() ? (partnerSnap.data() as any) : {};

    if (myData.partnerUid && myData.partnerUid !== partnerUid) {
      throw new Error('You are already linked to someone else');
    }
    if (partnerData.partnerUid && partnerData.partnerUid !== myUid) {
      throw new Error('Code owner is already linked to someone else');
    }

    // Deterministic pairId (sorted)
    const pairId = [myUid, partnerUid].sort().join('_');

    tx.update(myRef, {
      partnerUid,
      pairId,
      updatedAt: serverTimestamp(),
      pairCode: null,
      pairCodeExpiresAt: null,
    });
    tx.update(partnerRef, {
      partnerUid: myUid,
      pairId,
      updatedAt: serverTimestamp(),
      pairCode: null,
      pairCodeExpiresAt: null,
    });

    // Mark used (audit)
    tx.update(codeRef, { used: true, usedAt: serverTimestamp() });
    return { partnerUid, pairId };
  }).then(async (res) => {
    // Hard delete after success
    try {
      await deleteDoc(doc(db, 'pairCodes', code));
    } catch {}
    return res;
  });
}

/** Convenience unlink (optional) */
export async function unlinkPartners(myUid: string, partnerUid: string) {
  const myRef = doc(db, 'users', myUid);
  const ptRef = doc(db, 'users', partnerUid);
  await updateDoc(myRef, { partnerUid: null, pairId: null, updatedAt: serverTimestamp() }).catch(() => {});
  await updateDoc(ptRef, { partnerUid: null, pairId: null, updatedAt: serverTimestamp() }).catch(() => {});
}

/** Manual revoke (rarely needed now that we auto-expire) */
export async function revokePairCode(code: string) {
  await deleteDoc(doc(db, 'pairCodes', code));
}
