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
    updateDoc,
    where,
} from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';
import type { Memory, MemoryKind } from '../types';

const coll = collection(db, 'memories');

export type NewMemoryInput = {
  kind: MemoryKind;
  label: string;
  value: string;
  notes?: string;
  link?: string;
  gift?: string;
  idea?: string;
};

/** Create: (ownerId, data) — matches how the screen calls it */
export async function addMemory(ownerId: string, data: NewMemoryInput) {
  const ref = await addDoc(coll, {
    ownerId,
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

/** Update by doc id */
export async function updateMemory(id: string, patch: Partial<NewMemoryInput>) {
  await updateDoc(doc(db, 'memories', id), {
    ...patch,
    updatedAt: serverTimestamp(),
  });
}

/** Delete by doc id */
export async function deleteMemory(id: string) {
  await deleteDoc(doc(db, 'memories', id));
}

/** List all for an owner (newest first) */
export async function listByOwner(ownerId: string): Promise<Memory[]> {
  const q = query(coll, where('ownerId', '==', ownerId), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) } as Memory));
}

/** List by kind for an owner (newest first) */
export async function listByKind(ownerId: string, kind: MemoryKind): Promise<Memory[]> {
  const q = query(
    coll,
    where('ownerId', '==', ownerId),
    where('kind', '==', kind),
    orderBy('createdAt', 'desc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) } as Memory));
}

/** (Optional) alias if your screen still imports this older name */
export const createMemory = addMemory;
