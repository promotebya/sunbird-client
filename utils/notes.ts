// utils/notes.ts
import {
    addDoc,
    collection,
    deleteDoc,
    doc,
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

export type NoteKind = 'private' | 'shared';

export type Note = {
  id: string;
  ownerId: string;
  pairId?: string | null;
  kind: NoteKind;
  text: string;
  templateKey?: string | null;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
};

const coll = collection(db, 'notes');

/** Create a single note (private or shared). */
export async function addNote(params: {
  ownerId: string;
  pairId?: string | null;
  kind: NoteKind;
  text: string;
  templateKey?: string | null;
}) {
  const { ownerId, pairId = null, kind, text, templateKey = null } = params;
  return addDoc(coll, {
    ownerId,
    pairId,
    kind,
    text,
    templateKey,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

/** Update text or templateKey. */
export async function updateNote(id: string, data: Partial<Pick<Note, 'text' | 'templateKey'>>) {
  await updateDoc(doc(db, 'notes', id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteNote(id: string) {
  await deleteDoc(doc(db, 'notes', id));
}

/** Get a one-off list for owner (private) + pair (shared) merged, newest first. */
export async function listNotes(ownerId: string, pairId?: string | null) {
  const parts: Note[] = [];

  // private
  const q1 = query(coll, where('ownerId', '==', ownerId), where('kind', '==', 'private'), orderBy('createdAt', 'desc'));
  const s1 = await getDocs(q1);
  s1.forEach(d => parts.push({ id: d.id, ...(d.data() as any) }));

  // shared (if any)
  if (pairId) {
    const q2 = query(coll, where('pairId', '==', pairId), where('kind', '==', 'shared'), orderBy('createdAt', 'desc'));
    const s2 = await getDocs(q2);
    s2.forEach(d => parts.push({ id: d.id, ...(d.data() as any) }));
  }

  // sort by createdAt desc (in case serverTimestamp pending)
  return parts.sort((a, b) => {
    const ta = (a.createdAt?.toMillis?.() ?? 0);
    const tb = (b.createdAt?.toMillis?.() ?? 0);
    return tb - ta;
  });
}

/** Live listener for private + shared. */
export function listenNotes(ownerId: string, pairId: string | null, cb: (notes: Note[]) => void) {
  const unsubs: Array<() => void> = [];
  let priv: Note[] = [];
  let shared: Note[] = [];

  const push = () => {
    const merged = [...priv, ...shared].sort((a, b) => {
      const ta = a.createdAt?.toMillis?.() ?? 0;
      const tb = b.createdAt?.toMillis?.() ?? 0;
      return tb - ta;
    });
    cb(merged);
  };

  // private
  const q1 = query(coll, where('ownerId', '==', ownerId), where('kind', '==', 'private'), orderBy('createdAt', 'desc'));
  unsubs.push(onSnapshot(q1, snap => {
    priv = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
    push();
  }));

  // shared
  if (pairId) {
    const q2 = query(coll, where('pairId', '==', pairId), where('kind', '==', 'shared'), orderBy('createdAt', 'desc'));
    unsubs.push(onSnapshot(q2, snap => {
      shared = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
      push();
    }));
  }

  return () => unsubs.forEach(u => u());
}
