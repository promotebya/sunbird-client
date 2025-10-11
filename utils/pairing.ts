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

/** ----------------------------------------------------------------
 * Pairing helpers for LovePoints (Firestore modular SDK)
 * ----------------------------------------------------------------
 * Security rules interplay:
 * - You (self) can read/update your own /users/{myUid}.
 * - You MUST NOT read your partner's /users/{partnerUid} (rules forbid it).
 * - For partner writes, only change `pairId` and `partnerUid` to pass
 *   the .hasOnly(['pairId','partnerUid'(,'updatedAt')]) checks.
 * - Unlink uses a writeBatch (no implicit reads like transactions do).
 * ---------------------------------------------------------------- */

const EXPIRY_MINUTES = 30; // single-use code validity

export type PairCodeInfo = { code: string; expiresAtISO: string };

function randomCode(): string {
  // 6-digit numeric (easy to share verbally)
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function expiryFromNow(minutes = EXPIRY_MINUTES) {
  const d = new Date();
  d.setMinutes(d.getMinutes() + minutes);
  return d;
}

function pairIdFor(a: string, b: string) {
  return a <= b ? `${a}_${b}` : `${b}_${a}`;
}

/** Helper: read my current pairId from /users/{uid} (self-read is allowed). */
export async function getPairId(uid: string): Promise<string | null> {
  if (!uid) return null;
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return null;
  const data = snap.data() as any;
  return (data?.pairId as string | null) ?? null;
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

  // Best-effort: clear stale reference on the user doc
  try {
    await updateDoc(doc(db, 'users', ownerUid), {
      pairCode: null,
      pairCodeExpiresAt: null,
      updatedAt: serverTimestamp(),
    });
  } catch {
    // ignore
  }
}

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
      // Convenience stash on user
      try {
        await updateDoc(doc(db, 'users', ownerUid), {
          pairCode: code,
          pairCodeExpiresAt: expiresAtISO,
          updatedAt: serverTimestamp(),
        });
      } catch {
        // ignore
      }
      return { code, expiresAtISO };
    }
  }
  throw new Error('Could not generate code. Please try again.');
}

/**
 * Redeem a partner’s code and link both accounts.
 *
 * IMPORTANT:
 *  - No reads of the partner’s /users doc (forbidden by rules).
 *  - Single batch:
 *      • upsert /pairs/{pairId} (status: 'active')
 *      • set my user with partnerUid/pairId (+ clear my code fields)
 *      • set partner user with ONLY partnerUid/pairId (no updatedAt unless rules allow)
 *      • delete /pairCodes/{code}
 */
export async function redeemPairCode(
  myUid: string,
  code: string
): Promise<{ partnerUid: string; pairId: string }> {
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
  const pairId = pairIdFor(myUid, partnerUid);

  const batch = writeBatch(db);

  // Upsert pair (active)
  batch.set(
    doc(db, 'pairs', pairId),
    {
      members: [myUid, partnerUid],
      status: 'active',
      updatedAt: serverTimestamp(),
      // (Optional) createdAt will be overwritten on re-link; omit if you care about first-created timestamp
      createdAt: serverTimestamp(),
    },
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

  // Partner user — ONLY change the two keys to satisfy current rules
  batch.set(
    doc(db, 'users', partnerUid),
    {
      partnerUid: myUid,
      pairId,
      // OPTIONAL: if your deployed rules allow it, add: updatedAt: serverTimestamp(),
    } as any,
    { merge: true }
  );

  // One-time use
  batch.delete(codeRef);

  await batch.commit();

  // Best-effort hard delete (race-safe)
  try {
    await deleteDoc(codeRef);
  } catch {
    // ignore
  }

  return { partnerUid, pairId };
}

/**
 * Unlink both accounts (NO partner reads).
 *
 * Strategy:
 *  1) Read my own user (allowed) to get partnerUid & pairId.
 *  2) Single writeBatch:
 *      • me: set partnerUid=null, pairId=null, updatedAt=now
 *      • partner: ONLY set partnerUid=null & pairId=null (rules allow just these keys)
 *      • pairs/{pairId}: status='inactive', members=[], unlinkedAt=now (best-effort)
 *
 * This is idempotent and avoids the "permission-denied on partner read".
 */
export async function unlinkPair(
  myUid: string
): Promise<{ partnerUid: string | null; pairId: string | null }> {
  if (!myUid) throw new Error('Missing uid');

  // 1) Read self (allowed)
  const meRef = doc(db, 'users', myUid);
  const meSnap = await getDoc(meRef);

  if (!meSnap.exists()) {
    // If somehow missing, still clear my fields best-effort
    const batch0 = writeBatch(db);
    batch0.set(
      meRef,
      { partnerUid: null, pairId: null, updatedAt: serverTimestamp() },
      { merge: true }
    );
    await batch0.commit().catch(() => {});
    return { partnerUid: null, pairId: null };
  }

  const me = meSnap.data() as any;
  const partnerUid: string | null = me?.partnerUid ?? null;
  const pid: string | null = me?.pairId ?? null;

  // 2) Batch writes (no reads of partner)
  const batch = writeBatch(db);

  // Always clear my own doc
  batch.set(
    meRef,
    { partnerUid: null, pairId: null, updatedAt: serverTimestamp() },
    { merge: true }
  );

  if (partnerUid && pid) {
    // Only change the two allowed fields on the partner doc
    const partnerRef = doc(db, 'users', partnerUid);
    batch.set(
      partnerRef,
      {
        partnerUid: null,
        pairId: null,
        // OPTIONAL (requires your updated rules): updatedAt: serverTimestamp(),
      } as any,
      { merge: true }
    );

    // Best-effort: mark pair inactive
    const pairRef = doc(db, 'pairs', pid);
    batch.set(
      pairRef,
      {
        status: 'inactive',
        members: [],
        unlinkedAt: serverTimestamp(),
        // updatedAt: serverTimestamp(), // allowed by the tightened pairs rule
      } as any,
      { merge: true }
    );
  }

  await batch.commit();

  return { partnerUid, pairId: pid };
}