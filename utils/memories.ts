// utils/memories.ts
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';

/** Extend/adjust kinds freely */
export type MemoryKind =
  | 'favoriteFood'
  | 'place'
  | 'idea'
  | 'gift'
  | 'habit'
  | 'link'
  | string;

export interface Memory {
  id: string;
  ownerId: string;
  pairId?: string | null;
  kind: MemoryKind;

  /** Primary display text */
  label: string;

  /** Back-compat alias some screens still read */
  value?: string | null;

  /** Optional extras */
  notes?: string | null;
  url?: string | null;

  /** Timestamps (nullable while pending) */
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface CreateMemoryInput {
  ownerId: string;
  pairId?: string | null;
  kind: MemoryKind;
  label?: string;        // allow either label or value
  value?: string;        // (we'll normalize)
  notes?: string | null;
  url?: string | null;
}

export type UpdateMemoryInput = Partial<
  Omit<Memory, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>
> & { pairId?: string | null };

const coll = collection(db, 'memories');

/** Defensive normalizer that tolerates older/newer shapes */
function normalize(docSnap: any): Memory {
  const data = (docSnap?.data?.() ?? {}) as Record<string, any>;

  const label = (data.label ?? data.value ?? '').toString();
  const value = data.value ?? data.label ?? null;

  const createdAt =
    (data.createdAt as Timestamp | undefined) ?? null;
  const updatedAt =
    (data.updatedAt as Timestamp | undefined) ?? null;

  return {
    id: docSnap.id,
    ownerId: data.ownerId,
    pairId: data.pairId ?? null,
    kind: data.kind,
    label,
    value,
    notes: data.notes ?? null,
    url: data.url ?? null,
    createdAt,
    updatedAt,
  };
}

/* ----------------------------------------------------------------------------
 * CRUD
 * --------------------------------------------------------------------------*/

export async function createMemory(input: CreateMemoryInput): Promise<string> {
  const label = input.label ?? input.value ?? '';
  const ref = await addDoc(coll, {
    ownerId: input.ownerId,
    pairId: input.pairId ?? null,
    kind: input.kind,
    label,
    value: label, // keep both for compatibility
    notes: input.notes ?? null,
    url: input.url ?? null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateMemory(id: string, patch: UpdateMemoryInput) {
  // Keep label/value in sync if either is provided
  const updates: Record<string, any> = { ...patch, updatedAt: serverTimestamp() };
  if (patch.label != null && updates.value == null) updates.value = patch.label;
  if (patch.value != null && updates.label == null) updates.label = patch.value;

  const ref = doc(db, 'memories', id);
  await updateDoc(ref, updates);
}

export async function deleteMemory(id: string) {
  await deleteDoc(doc(db, 'memories', id));
}

export async function getMemory(id: string): Promise<Memory | null> {
  const snap = await getDoc(doc(db, 'memories', id));
  if (!snap.exists()) return null;
  return normalize(snap);
}

/* ----------------------------------------------------------------------------
 * One-shot queries (newest first)
 * --------------------------------------------------------------------------*/

export async function listMine(ownerId: string): Promise<Memory[]> {
  const q = query(coll, where('ownerId', '==', ownerId), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(normalize);
}

/** Alias so existing imports (`listByOwner`) keep working */
export const listByOwner = listMine;

export async function listByKind(ownerId: string, kind: MemoryKind): Promise<Memory[]> {
  const q = query(
    coll,
    where('ownerId', '==', ownerId),
    where('kind', '==', kind),
    orderBy('createdAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(normalize);
}

export async function listByPair(pairId: string): Promise<Memory[]> {
  const q = query(coll, where('pairId', '==', pairId), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(normalize);
}

/* ----------------------------------------------------------------------------
 * Live listeners
 * --------------------------------------------------------------------------*/

export function listenMine(ownerId: string, cb: (items: Memory[]) => void) {
  const q = query(coll, where('ownerId', '==', ownerId), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snap) => cb(snap.docs.map(normalize)));
}

export function listenByKind(
  ownerId: string,
  kind: MemoryKind,
  cb: (items: Memory[]) => void
) {
  const q = query(
    coll,
    where('ownerId', '==', ownerId),
    where('kind', '==', kind),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(q, (snap) => cb(snap.docs.map(normalize)));
}

export function listenByPair(pairId: string, cb: (items: Memory[]) => void) {
  const q = query(coll, where('pairId', '==', pairId), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snap) => cb(snap.docs.map(normalize)));
}
