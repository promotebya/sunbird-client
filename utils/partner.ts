// utils/partner.ts
import {
    collection,
    doc,
    getDoc,
    serverTimestamp,
    setDoc,
    writeBatch
} from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';

/**
 * Generate a short, friendly, uppercase code like "AB7KQ9".
 * (You can replace this with your own generator if you prefer)
 */
function genCode(len = 6) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

/**
 * Create/share an invite code.
 * - Stores a doc in partnerLinks/{code}: { code, ownerId, createdAt }
 * - If the same user creates again, we simply overwrite with a new code (last one wins).
 */
export async function createInviteCode(uid: string): Promise<string> {
  if (!uid) throw new Error('Missing uid');

  // generate a code and ensure we don't collide with an existing doc
  // (super rare; if it happens, just try again once)
  let code = genCode(6);
  const linkRef = doc(collection(db, 'partnerLinks'), code);
  const snap = await getDoc(linkRef);
  if (snap.exists()) {
    code = genCode(6);
  }

  await setDoc(linkRef, {
    code,
    ownerId: uid,
    createdAt: serverTimestamp(),
  });

  return code;
}

/**
 * Join with an invite code.
 * Steps:
 *  - read partnerLinks/{code}
 *  - create pairs/{pairId} with both members
 *  - set users/{uid}.pairId and users/{other}.pairId
 *  - delete partnerLinks/{code}
 * Uses a transaction/batch so either all succeed or none.
 */
export async function joinWithCode(uid: string, code: string): Promise<void> {
  if (!uid) throw new Error('Missing uid');
  const cleanCode = code.trim().toUpperCase();
  if (!cleanCode) throw new Error('Missing code');

  const linkRef = doc(collection(db, 'partnerLinks'), cleanCode);
  const linkSnap = await getDoc(linkRef);
  if (!linkSnap.exists()) throw new Error('Code not found');
  const link = linkSnap.data() as { ownerId: string };
  const otherUid = link.ownerId;

  if (otherUid === uid) throw new Error('You cannot use your own code');

  // Guard: prevent joining if either user is already paired
  const meRef = doc(db, 'users', uid);
  const otherRef = doc(db, 'users', otherUid);

  const meSnap = await getDoc(meRef);
  const otherSnap = await getDoc(otherRef);

  if (!meSnap.exists()) throw new Error('Your user profile is missing');
  if (!otherSnap.exists()) throw new Error("Partner's user profile is missing");

  const me = meSnap.data() as any;
  const other = otherSnap.data() as any;

  if (me.pairId) throw new Error('You are already linked to a partner');
  if (other.pairId) throw new Error('That code owner is already linked to a partner');

  // Create the pair and update both users + delete the code in one atomic batch
  const batch = writeBatch(db);
  // pairs/{pairId} — use a deterministic id sorted by uids to avoid dupes
  const pairId =
    uid < otherUid ? `${uid}_${otherUid}` : `${otherUid}_${uid}`;
  const pairRef = doc(db, 'pairs', pairId);

  batch.set(pairRef, {
    members: [uid, otherUid],
    createdAt: serverTimestamp(),
  });

  batch.update(meRef, { pairId, updatedAt: serverTimestamp() });
  batch.update(otherRef, { pairId, updatedAt: serverTimestamp() });

  batch.delete(linkRef);

  await batch.commit();
}
