// utils/memories.ts
import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDocs,
    orderBy,
    query,
    serverTimestamp,
    Timestamp,
    updateDoc,
    where,
} from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';

export type MemoryKind = 'idea' | 'link' | 'gift' | 'note';

export type Memory = {
  id: string;
  ownerId: string;
  kind: MemoryKind;
  label: string;
  value: string;      // url for links, text for others
  notes?: string;
  createdAt: number;  // millis
};

export type NewMemory = {
  ownerId: string;
  kind: MemoryKind;
  label: string;
  value: string;
  notes?: string;
  createdAt?: number; // optional; will default to serverTimestamp
};

export type UpdateMemoryInput = {
  ownerId?: string;
  kind?: MemoryKind;
  label?: string;
  value?: string;
  notes?: string;
};

const coll = collection(db, 'memories');

/** List all memories for a user (newest first). Requires index on (ownerId, createdAt desc). */
export async function listByOwner(ownerId: string): Promise<Memory[]> {
  const q = query(coll, where('ownerId', '==', ownerId), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data() as any;
    // tolerate either Timestamp or number
    const created =
      data.createdAt instanceof Timestamp
        ? data.createdAt.toMillis()
        : typeof data.createdAt === 'number'
        ? data.createdAt
        : Date.now();
    return {
      id: d.id,
      ownerId: data.ownerId,
      kind: data.kind as MemoryKind,
      label: data.label,
      value: data.value,
      notes: data.notes,
      createdAt: created,
    } as Memory;
  });
}

/** Create and return the new document id. */
export async function createMemory(input: NewMemory): Promise<string> {
  const payload: any = {
    ownerId: input.ownerId,
    kind: input.kind,
    label: input.label,
    value: input.value,
    notes: input.notes ?? '',
    createdAt: input.createdAt ?? serverTimestamp(),
  };
  const ref = await addDoc(coll, payload);
  return ref.id;
}

/** Partial update by id. */
export async function updateMemory(id: string, input: UpdateMemoryInput): Promise<void> {
  const ref = doc(db, 'memories', id);
  await updateDoc(ref, { ...input });
}

/** Delete by id. */
export async function deleteMemory(id: string): Promise<void> {
  const ref = doc(db, 'memories', id);
  await deleteDoc(ref);
}
