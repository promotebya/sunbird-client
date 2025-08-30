// utils/memories.ts
import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    DocumentData,
    getDocs,
    onSnapshot,
    orderBy,
    query,
    QueryDocumentSnapshot,
    serverTimestamp,
    Timestamp,
    updateDoc,
    where,
} from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';
import type { Memory, MemoryInput, MemoryKind, MemoryPatch } from '../types';

const coll = collection(db, 'memories');

function toDate(v: any): Date | null {
  if (!v) return null;
  if (typeof v === 'object' && 'toDate' in v) return (v as Timestamp).toDate();
  return v instanceof Date ? v : null;
}

function fromSnap(s: QueryDocumentSnapshot<DocumentData>): Memory {
  const raw = s.data() || {};
  return {
    id: s.id,
    ownerId: raw.ownerId,
    kind: raw.kind,
    label: raw.label ?? '',
    value: raw.value ?? '',
    notes: raw.notes ?? '',
    link: raw.link ?? '',
    date: toDate(raw.date),
    remindOn: toDate(raw.remindOn),
    createdAt: toDate(raw.createdAt),
    updatedAt: toDate(raw.updatedAt),
  } as Memory;
}

export function listenMemories(
  ownerId: string,
  opts: { kind?: MemoryKind | 'all' },
  cb: (rows: Memory[]) => void
) {
  const filters = [where('ownerId', '==', ownerId)];
  if (opts.kind && opts.kind !== 'all') filters.push(where('kind', '==', opts.kind));
  const q = query(coll, ...filters, orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snap) => cb(snap.docs.map(fromSnap)));
}

export async function listByKind(
  ownerId: string,
  kind: MemoryKind | 'all' = 'all'
): Promise<Memory[]> {
  const filters = [where('ownerId', '==', ownerId)];
  if (kind !== 'all') filters.push(where('kind', '==', kind));
  const q = query(coll, ...filters, orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(fromSnap);
}

export async function addMemory(ownerId: string, input: MemoryInput) {
  const payload: any = {
    ownerId,
    kind: input.kind,
    label: input.label ?? '',
    value: input.value ?? '',
    notes: input.notes ?? '',
    link: input.link ?? '',
    date: input.date ? Timestamp.fromDate(input.date) : null,
    remindOn: input.remindOn ? Timestamp.fromDate(input.remindOn) : null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  const ref = await addDoc(coll, payload);
  return ref.id;
}

export async function updateMemory(id: string, patch: MemoryPatch) {
  const ref = doc(db, 'memories', id);
  const payload: any = {
    ...('label' in patch ? { label: patch.label } : {}),
    ...('value' in patch ? { value: patch.value } : {}),
    ...('notes' in patch ? { notes: patch.notes } : {}),
    ...('link' in patch ? { link: patch.link } : {}),
    ...('kind' in patch ? { kind: patch.kind } : {}),
    ...('date' in patch ? { date: patch.date ? Timestamp.fromDate(patch.date) : null } : {}),
    ...('remindOn' in patch
      ? { remindOn: patch.remindOn ? Timestamp.fromDate(patch.remindOn) : null }
      : {}),
    updatedAt: serverTimestamp(),
  };
  await updateDoc(ref, payload);
}

export async function deleteMemory(id: string) {
  await deleteDoc(doc(db, 'memories', id));
}
