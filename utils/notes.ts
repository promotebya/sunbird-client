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
import { db } from "../firebaseConfig";

export type Note = {
  id?: string;
  ownerId: string;
  pairId?: string | null;
  text: string;
  kind?: string; // optional filter field if you use categories
  createdAt?: any;
  updatedAt?: any;
};

const col = collection(db, "notes");

export async function listByOwner(ownerId: string) {
  const q = query(col, where("ownerId", "==", ownerId), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Note[];
}

export async function listByPair(pairId: string) {
  const q = query(col, where("pairId", "==", pairId), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Note[];
}

export async function listByKind(ownerId: string, kind: string) {
  const q = query(
    col,
    where("ownerId", "==", ownerId),
    where("kind", "==", kind),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Note[];
}

export async function create(input: Omit<Note, "id" | "createdAt" | "updatedAt">) {
  const payload = { ...input, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
  const res = await addDoc(col, payload as any);
  return res.id;
}

export async function update(id: string, patch: Partial<Note>) {
  await updateDoc(doc(db, "notes", id), { ...patch, updatedAt: serverTimestamp() } as any);
}

export async function remove(id: string) {
  await deleteDoc(doc(db, "notes", id));
}
