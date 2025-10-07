// utils/partner.ts
import {
  doc,
  getDoc,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
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

/**
 * Redeem a 4–8 digit pair code and connect the current user to the owner.
 * We accept MANY field shapes so it works with existing data:
 *   pairCodes/{code} can include ANY of:
 *     - ownerId / ownerUid / userId / uid / creatorUid / createdBy / issuerId / forUid / partnerUid (strings)
 *     - owner.uid / owner.id / creator.uid / createdBy.uid / user.uid / issuer.uid (objects)
 *     - members: [uidA, uidB] (array) — we’ll pick the other uid
 * Optionally: pairId
 * On success:
 *   - upserts pairs/{pairId}
 *   - sets users/{uid}.pairId & .partnerUid for both users
 *   - deletes the code doc
 */
export async function redeemPairCode(code: string, myUid: string): Promise<string> {
  const codeId = String(code).trim();

  const codeRef = doc(db, 'pairCodes', codeId);
  const codeSnap = await getDoc(codeRef);
  if (!codeSnap.exists()) {
    throw new Error('Invalid or expired code.');
  }

  const data = codeSnap.data() as any;

  // Try very hard to discover the other user's UID from many shapes
  const stringKeys = [
    'ownerId',
    'ownerUid',
    'uid',
    'userId',
    'creatorUid',
    'createdBy',
    'issuerId',
    'forUid',
    'partnerUid',
    'issuedBy',
    'authorUid',
  ];

  let found: string | null = null;

  for (const k of stringKeys) {
    const v = data?.[k];
    if (typeof v === 'string' && v.trim()) {
      found = v.trim();
      break;
    }
  }

  const objectKeyPairs: Array<[string, string]> = [
    ['owner', 'uid'],
    ['owner', 'id'],
    ['creator', 'uid'],
    ['createdBy', 'uid'],
    ['user', 'uid'],
    ['issuer', 'uid'],
  ];

  if (!found) {
    for (const [root, leaf] of objectKeyPairs) {
      const v = data?.[root]?.[leaf];
      if (typeof v === 'string' && v.trim()) {
        found = v.trim();
        break;
      }
    }
  }

  // Also handle a pre-filled members array
  if (!found && Array.isArray(data?.members) && data.members.length >= 1) {
    const candidates = (data.members as any[])
      .filter((x) => typeof x === 'string')
      .map((x) => String(x));
    const other = candidates.find((u) => u !== myUid);
    if (other) found = other;
  }

  if (!found) {
    throw new Error('Invalid code payload.');
  }

  const otherUid = found;
  if (otherUid === myUid) {
    throw new Error("That's your own code.");
  }

  const pairId: string = data?.pairId || [myUid, otherUid].sort().join('_');

  const batch = writeBatch(db);

  // Create/merge the pair
  batch.set(
    doc(db, 'pairs', pairId),
    { members: [myUid, otherUid], createdAt: serverTimestamp() },
    { merge: true }
  );

  // Attach to both users
  batch.set(doc(db, 'users', myUid), { pairId, partnerUid: otherUid }, { merge: true });
  batch.set(doc(db, 'users', otherUid), { pairId, partnerUid: myUid }, { merge: true });

  // One-time use
  batch.delete(codeRef);

  await batch.commit();
  return pairId;
}