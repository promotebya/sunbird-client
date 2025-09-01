// utils/memories.ts
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  DocumentData,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  QuerySnapshot,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';

/** Kinds we currently use around the app (extend freely) */
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
  /** When a memory is “shared”, associate to a pair/couple if you use pairing */
  pairId?: string | null;
  kind: MemoryKind;

  /** A short title/label (what we show in chips and lists) */
  label: string;

  /** Optional extra text/notes */
  notes?: string | null;

  /** Optional URL if this memory is a link/website */
  url?: string | null;

  /** Firestore server timestamps (nullable while pending write) */
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

/** Input to create a memory */
export interface CreateMemoryInput {
  ownerId: string;
  pairId?: string | null;
  kind: MemoryKind;
  label: string;
  notes?: string | null;
  url?: string | null;
}

/** Partial update */
export type UpdateMemoryInput = Partial<
  Omit<Memory, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>
> & { pairId?: string | null };

/** Firestore collection ref */
const coll = collection(db, 'memories');

/** Normalize a Firestore doc into our Memory shape */
function normalize(docSnap: QuerySnapshot<DocumentData>['docs'][number]): Memory {
  const data = docSnap.data() as Omit<Memory, 'id'>;
  return {
    id: docSnap.id,
    ownerId: data.ownerId,
    pairId: data.pairId ?? null,
    kind: data.kind,
    label: data.label,
    notes: data.notes ?? null,
    url: data.url ?? null,
    createdAt: (data as any).createdAt ?? null,
    updatedAt: (data as any).updatedAt ?? null,
  };
}

/* ----------------------------------------------------------------------------
 * CRUD
 * --------------------------------------------------------------------------*/

export async function createMemory(input: CreateMemoryInput): Promise<string> {
  const ref = await addDoc(coll, {
    ownerId: input.ownerId,
    pairId: input.pairId ?? null,
    kind: input.kind,
    label: input.label,
    notes: input.notes ?? null,
    url: input.url ?? null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateMemory(id: string, patch: UpdateMemoryInput) {
  const ref = doc(db, 'memories', id);
  await updateDoc(ref, {
    ...patch,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteMemory(id: string) {
  const ref = doc(db, 'memories', id);
  await deleteDoc(ref);
}

export async function getMemory(id: string): Promise<Memory | null> {
  const ref = doc(db, 'memories', id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return normalize(snap as any);
}

/* ----------------------------------------------------------------------------
 * Queries (one-shot)
 * --------------------------------------------------------------------------*/

/** All memories for an owner (newest first) */
export async function listMine(ownerId: string, limitCount?: number): Promise<Memory[]> {
  const q = query(
    coll,
    where('ownerId', '==', ownerId),
    orderBy('createdAt', 'desc'),
    ...(limitCount ? ([{ type: 'limit', value: limitCount }] as any) : [])
  ) as any;
  const snap = await getDocs(q);
  return snap.docs.map(normalize);
}

/** Memories by kind for an owner (used for quick prompts) */
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

/** Shared memories for a pair/couple (if you use `pairId`) */
export async function listByPair(pairId: string): Promise<Memory[]> {
  const q = query(
    coll,
    where('pairId', '==', pairId),
    orderBy('createdAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(normalize);
}

/* ----------------------------------------------------------------------------
 * Live listeners
 * --------------------------------------------------------------------------*/

/** Live list for owner (unsubscribe returned) */
export function listenMine(
  ownerId: string,
  cb: (items: Memory[]) => void
) {
  const q = query(
    coll,
    where('ownerId', '==', ownerId),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map(normalize));
  });
}

/** Live list by kind for owner (unsubscribe returned) */
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
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map(normalize));
  });
}

/** Live list for a pair (unsubscribe returned) */
export function listenByPair(
  pairId: string,
  cb: (items: Memory[]) => void
) {
  const q = query(
    coll,
    where('pairId', '==', pairId),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map(normalize));
  });
}
