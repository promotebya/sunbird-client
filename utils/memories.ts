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

export interface MemoryCreate {
  kind: MemoryKind;
  label: string;
  value?: string | null;
  notes?: string | null;
}

export interface Memory extends MemoryCreate {
  id: string;
  ownerId: string;
  createdAt: Timestamp | Date | null;
  updatedAt?: Timestamp | Date | null;
  value: string | null;
  notes: string | null;
}

const coll = collection(db, 'memories');

export async function create(ownerId: string, data: MemoryCreate): Promise<string> {
  const payload = {
    ownerId,
    kind: data.kind,
    label: data.label,
    value: (data.value ?? null) as string | null,
    notes: (data.notes ?? null) as string | null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  const ref = await addDoc(coll, payload);
  return ref.id;
}

export async function remove(id: string): Promise<void> {
  await deleteDoc(doc(db, 'memories', id));
}

export async function update(
  id: string,
  data: Partial<Pick<Memory, 'label' | 'value' | 'notes' | 'kind'>>
): Promise<void> {
  await updateDoc(doc(db, 'memories', id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function listByOwner(ownerId: string): Promise<Memory[]> {
  const q = query(coll, where('ownerId', '==', ownerId), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const raw = d.data() as any;
    return {
      id: d.id,
      ownerId: raw.ownerId as string,
      kind: raw.kind as MemoryKind,
      label: raw.label as string,
      value: (raw.value ?? null) as string | null,
      notes: (raw.notes ?? null) as string | null,
      createdAt: (raw.createdAt ?? null) as Timestamp | Date | null,
      updatedAt: (raw.updatedAt ?? null) as Timestamp | Date | null,
    } as Memory;
  });
}

/** NEW: list by owner & kind (requires composite index: ownerId + kind + createdAt desc) */
export async function listByKind(ownerId: string, kind: MemoryKind): Promise<Memory[]> {
  const q = query(
    coll,
    where('ownerId', '==', ownerId),
    where('kind', '==', kind),
    orderBy('createdAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const raw = d.data() as any;
    return {
      id: d.id,
      ownerId: raw.ownerId as string,
      kind: raw.kind as MemoryKind,
      label: raw.label as string,
      value: (raw.value ?? null) as string | null,
      notes: (raw.notes ?? null) as string | null,
      createdAt: (raw.createdAt ?? null) as Timestamp | Date | null,
      updatedAt: (raw.updatedAt ?? null) as Timestamp | Date | null,
    } as Memory;
  });
}
