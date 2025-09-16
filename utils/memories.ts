// utils/memories.ts
import {
  addDoc,
  collection,
  orderBy,
  query,
  serverTimestamp,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { listenQuery } from './snap';

export type MemoryKind = 'text' | 'milestone' | 'photo';

export type MemoryDoc = {
  id: string;
  ownerId: string;
  pairId?: string | null;
  kind: MemoryKind;
  title?: string | null;
  note?: string | null;
  photoURL?: string | null;
  clientTag?: string | null;
  createdAt?: any;
};

export function subscribeMemories(
  uid: string,
  _opts: {},
  onData: (items: MemoryDoc[]) => void
): Unsubscribe {
  const q = query(
    collection(db, 'memories'),
    where('ownerId', '==', uid),
    orderBy('createdAt', 'desc')
  );

  return listenQuery(q, (snap) => {
    const list: MemoryDoc[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
    onData(list);
  }, 'memories');
}

export async function createMemory(input: {
  ownerId: string;
  pairId?: string | null;
  kind: MemoryKind;
  title?: string | null;
  note?: string | null;
  photoURL?: string | null;
  clientTag?: string | null;
}) {
  await addDoc(collection(db, 'memories'), {
    ...input,
    createdAt: serverTimestamp(),
  });
}
