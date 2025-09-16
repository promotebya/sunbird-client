import { doc, onSnapshot } from 'firebase/firestore';
import type { PairDoc } from 'types/models';
import { db } from '../firebaseConfig';

export function listenPair(
  pairId: string,
  cb: (pair: (PairDoc & { id: string }) | null) => void
) {
  const ref = doc(db, 'pairs', pairId);
  return onSnapshot(ref, (snap) => {
    if (!snap.exists()) return cb(null);
    const data = snap.data() as Omit<PairDoc, 'id'>;
    cb({ id: snap.id, ...data });
  });
}
