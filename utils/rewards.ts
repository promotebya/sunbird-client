// utils/rewards.ts
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  DocumentData,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Unsubscribe,
  where,
} from 'firebase/firestore';
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

export async function addReward(
  ownerId: string,
  pairId: string | null,
  title: string,
  cost: number
) {
  await addDoc(collection(db, 'rewards'), {
    ownerId,
    pairId,
    title,
    cost,
    redeemed: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

function mapRows(docs: DocumentData[]): RewardDoc[] {
  return docs.map((d: any) => ({
    id: d.id,
    ...(d.data() as Omit<RewardDoc, 'id'>),
  }));
}

export function listenRewards(
  ownerId: string,
  pairId: string | null,
  cb: (items: RewardDoc[]) => void
): Unsubscribe {
  const col = collection(db, 'rewards');

  // Preferred (needs composite index: pairId + createdAt desc)
  const qWithOrder = pairId
    ? query(col, where('pairId', '==', pairId), orderBy('createdAt', 'desc'))
    : query(col, where('ownerId', '==', ownerId), orderBy('createdAt', 'desc'));

  // Fallback without order (we'll sort in JS)
  const qNoOrder = pairId
    ? query(col, where('pairId', '==', pairId))
    : query(col, where('ownerId', '==', ownerId));

  let detach: Unsubscribe = () => {};

  const attachNoOrder = () => {
    detach = onSnapshot(qNoOrder, (snap) => {
      const items = mapRows(snap.docs as any).sort((a, b) => {
        const ta =
          (a.createdAt?.toMillis?.() as number | undefined) ??
          (typeof a.createdAt?.seconds === 'number'
            ? a.createdAt.seconds * 1000
            : 0);
        const tb =
          (b.createdAt?.toMillis?.() as number | undefined) ??
          (typeof b.createdAt?.seconds === 'number'
            ? b.createdAt.seconds * 1000
            : 0);
        return tb - ta; // newest first
      });
      cb(items);
    });
  };

  // Try ordered query first
  detach = onSnapshot(
    qWithOrder,
    (snap) => {
      cb(mapRows(snap.docs as any));
    },
    (err: any) => {
      if (err?.code === 'failed-precondition') {
        console.warn(
          'Missing composite index for rewards; using client-side sort fallback.\n',
          err?.message ?? err
        );
        // Switch to fallback listener
        detach();
        attachNoOrder();
      } else {
        console.error('listenRewards error:', err);
      }
    }
  );

  return () => {
    try {
      detach && detach();
    } catch {}
  };
}

export async function redeemReward(
  ownerId: string,
  pairId: string | null,
  reward: RewardDoc
) {
  // record a negative points entry
  await createPointsEntry({
    ownerId,
    pairId,
    value: -Math.abs(reward.cost),
    reason: `Redeem: ${reward.title}`,
  });

  // optional: delete reward after redeem
  await deleteDoc(doc(db, 'rewards', reward.id));
}