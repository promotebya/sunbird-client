// utils/partner.ts
import {
  deleteDoc,
  doc,
  getDoc,
  runTransaction,
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
 * Accepts many shapes for legacy compatibility. On success:
 * - upserts pairs/{pairId}
 * - sets users/{uid}.pairId & .partnerUid for both users
 * - deletes the code doc
 */
export async function redeemPairCode(code: string, myUid: string): Promise<string> {
  const codeId = String(code).trim();

  const codeRef = doc(db, 'pairCodes', codeId);
  const codeSnap = await getDoc(codeRef);
  if (!codeSnap.exists()) throw new Error('Invalid or expired code.');
  const data = codeSnap.data() as any;

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

  if (!found && Array.isArray(data?.members) && data.members.length >= 1) {
    const candidates = (data.members as any[])
      .filter((x) => typeof x === 'string')
      .map((x) => String(x));
    const other = candidates.find((u) => u !== myUid);
    if (other) found = other;
  }

  if (!found) throw new Error('Invalid code payload.');
  const otherUid = found;
  if (otherUid === myUid) throw new Error("That's your own code.");

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

/**
 * Unlink the current user from their partner.
 * - Clears users/{uid}.partnerUid, .pairId for both users (rules updated to allow partner clearing)
 * - Updates or deletes pairs/{pairId}
 * - Never violates "all reads before writes" constraint.
 */
export async function unlinkPair(myUid: string): Promise<void> {
  if (!myUid) return;

  await runTransaction(db, async (tx) => {
    const myRef = doc(db, 'users', myUid);
    const mySnap = await tx.get(myRef);
    if (!mySnap.exists()) return;

    const my = mySnap.data() as any;
    const partnerUid: string | null = my?.partnerUid ?? null;
    const pairId: string | null = my?.pairId ?? null;

    const partnerRef = partnerUid ? doc(db, 'users', partnerUid) : null;
    const pairRef    = pairId ? doc(db, 'pairs', pairId) : null;

    const partnerSnap = partnerRef ? await tx.get(partnerRef) : null;
    const pairSnap    = pairRef ? await tx.get(pairRef) : null;

    // ---- WRITES (after all reads) ----

    // Clear me
    tx.update(myRef, {
      partnerUid: null,
      pairId: null,
      updatedAt: serverTimestamp(),
    });

    // Best-effort: clear partner if they still point to me/same pair (rules now allow this)
    if (partnerRef && partnerSnap?.exists()) {
      const p = partnerSnap.data() as any;
      if (p?.partnerUid === myUid || (pairId && p?.pairId === pairId)) {
        tx.update(partnerRef, {
          partnerUid: null,
          pairId: null,
          updatedAt: serverTimestamp(),
        });
      }
    }

    // Update/delete pair doc
    if (pairRef && pairSnap?.exists()) {
      const data = pairSnap.data() as any;

      // Normalize members shape
      let members: string[] = [];
      if (Array.isArray(data?.members)) members = data.members.slice();
      else if (Array.isArray(data?.userIds)) members = data.userIds.slice();
      else if (data?.userA || data?.userB) members = [data?.userA, data?.userB].filter(Boolean);
      else if (data?.ownerId || data?.partnerId) members = [data?.ownerId, data?.partnerId].filter(Boolean);

      const removeSet = new Set([myUid, partnerUid ?? '']);
      members = members.filter((u) => u && !removeSet.has(u));

      if (members.length === 0) {
        tx.delete(pairRef);
      } else {
        const patch: any = {
          premiumActive: false,
          premiumUpdatedAt: serverTimestamp(),
          premiumUpdatedBy: myUid,
        };
        if ('members' in (data ?? {})) patch.members = members;
        else if ('userIds' in (data ?? {})) patch.userIds = members;
        else if ('userA' in (data ?? {}) || 'userB' in (data ?? {})) {
          patch.userA = members[0] ?? null;
          patch.userB = members[1] ?? null;
        } else if ('ownerId' in (data ?? {}) || 'partnerId' in (data ?? {})) {
          patch.ownerId = members[0] ?? null;
          patch.partnerId = members[1] ?? null;
        } else {
          patch.members = members;
        }
        tx.update(pairRef, patch);
      }
    }
  });

  // Optional best-effort cleanup if a stale pair doc still lingers
  try {
    const pid = await getPairId(myUid);
    if (pid) await deleteDoc(doc(db, 'pairs', pid));
  } catch {/* ignore */}
}