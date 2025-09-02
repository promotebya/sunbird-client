// utils/notes.ts
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

/** Categories specifically for Love Notes */
export type NoteKind =
  | 'loveNote'
  | 'favoriteFood'
  | 'habit'
  | 'place'
  | 'appreciation'
  | 'insideJoke'
  | 'gratitude'
  | 'memorySnippet';

export interface NoteCreate {
  kind: NoteKind;
  text: string;
  // optional helpers
  context?: string | null; // e.g., “morning”, “after work”
  templateId?: string | null;
}

export interface Note extends NoteCreate {
  id: string;
  ownerId: string;
  createdAt: Timestamp | Date | null;
  updatedAt?: Timestamp | Date | null;
  context: string | null;
  templateId: string | null;
}

const coll = collection(db, 'notes');

export async function create(ownerId: string, data: NoteCreate): Promise<string> {
  const payload = {
    ownerId,
    kind: data.kind,
    text: data.text,
    context: (data.context ?? null) as string | null,
    templateId: (data.templateId ?? null) as string | null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  const ref = await addDoc(coll, payload);
  return ref.id;
}

export async function update(
  id: string,
  data: Partial<Pick<Note, 'text' | 'context' | 'templateId' | 'kind'>>
): Promise<void> {
  await updateDoc(doc(db, 'notes', id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function remove(id: string): Promise<void> {
  await deleteDoc(doc(db, 'notes', id));
}

export async function listByOwner(ownerId: string): Promise<Note[]> {
  const q = query(coll, where('ownerId', '==', ownerId), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => {
    const raw = d.data() as any;
    return {
      id: d.id,
      ownerId: raw.ownerId as string,
      kind: raw.kind as NoteKind,
      text: raw.text as string,
      context: (raw.context ?? null) as string | null,
      templateId: (raw.templateId ?? null) as string | null,
      createdAt: (raw.createdAt ?? null) as Timestamp | Date | null,
      updatedAt: (raw.updatedAt ?? null) as Timestamp | Date | null,
    } as Note;
  });
}

/** Used by LoveNotesScreen chips like 'favoriteFood' | 'place' | 'habit' */
export async function listByKind(ownerId: string, kind: NoteKind): Promise<Note[]> {
  const q = query(
    coll,
    where('ownerId', '==', ownerId),
    where('kind', '==', kind),
    orderBy('createdAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => {
    const raw = d.data() as any;
    return {
      id: d.id,
      ownerId: raw.ownerId as string,
      kind: raw.kind as NoteKind,
      text: raw.text as string,
      context: (raw.context ?? null) as string | null,
      templateId: (raw.templateId ?? null) as string | null,
      createdAt: (raw.createdAt ?? null) as Timestamp | Date | null,
      updatedAt: (raw.updatedAt ?? null) as Timestamp | Date | null,
    } as Note;
  });
}
