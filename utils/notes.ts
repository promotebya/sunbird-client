import { db } from "@/firebaseConfig";
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
} from "firebase/firestore";

export type LoveNote = {
  id?: string;
  ownerId: string;
  pairId?: string | null;
  text: string;
  createdAt?: any;
  updatedAt?: any;
};

const col = collection(db, "notes");

export async function listNotesByOwner(ownerId: string) {
  const q = query(col, where("ownerId", "==", ownerId), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as LoveNote[];
}

export async function listNotesByPair(pairId: string) {
  const q = query(col, where("pairId", "==", pairId), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as LoveNote[];
}

export async function addNote(input: Omit<LoveNote, "id" | "createdAt" | "updatedAt">) {
  const payload = { ...input, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
  const res = await addDoc(col, payload as any);
  return res.id;
}

export async function updateNote(id: string, patch: Partial<LoveNote>) {
  await updateDoc(doc(db, "notes", id), { ...patch, updatedAt: serverTimestamp() } as any);
}

export async function deleteNote(id: string) {
  await deleteDoc(doc(db, "notes", id));
}
