// utils/rewards.ts
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, Unsubscribe, where } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { createPointsEntry } from './points';

export type RewardDoc = {
  id: string;
  ownerId: string;
  pairId?: string | null;
  title: string;
  cost: number; // in points
  redeemed?: boolean;
  redeemedAt?: any;
  createdAt?: any;
  updatedAt?: any;
};

export async function addReward(ownerId: string, pairId: string | null, title: string, cost: number) {
  await addDoc(collection(db, 'rewards'), {
    ownerId, pairId, title, cost, redeemed: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export function listenRewards(
  ownerId: string,
  pairId: string | null,
  cb: (items: RewardDoc[]) => void
): Unsubscribe {
  const base = collection(db, 'rewards');
  const q = pairId
    ? query(base, where('pairId', '==', pairId), orderBy('createdAt', 'desc'))
    : query(base, where('ownerId', '==', ownerId), orderBy('createdAt', 'desc'));

  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<RewardDoc, 'id'>) })));
  });
}

export async function redeemReward(ownerId: string, pairId: string | null, reward: RewardDoc) {
  // record a negative points entry
  await createPointsEntry({
    ownerId,
    pairId,
    value: -Math.abs(reward.cost),
    reason: `Redeem: ${reward.title}`,
  });
  // we could also mark redeemed in-place, but keeping it simple for MVP:
  // delete reward after redeem (optional)
  await deleteDoc(doc(db, 'rewards', reward.id));
}
