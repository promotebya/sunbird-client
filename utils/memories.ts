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

export enum MemoryKind {
  Photo = "photo",
  Text = "text",
  Milestone = "milestone",
}

export type Memory = {
  id?: string;
  ownerId: string;
  pairId?: string | null;
  kind?: MemoryKind | "photo" | "text" | "milestone";
  title: string;
  note?: string;
  // loose fields some UIs referenced previously:
  label?: string;
  value?: string | number;
  createdAt?: any;
  updatedAt?: any;
};

const col = collection(db, "memories");

export async function listByOwner(ownerId: string) {
  const q = query(col, where("ownerId", "==", ownerId), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Memory[];
}

export async function listByPair(pairId: string) {
  const q = query(col, where("pairId", "==", pairId), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Memory[];
}

export async function listByKind(ownerId: string, kind: MemoryKind | string) {
  const q = query(
    col,
    where("ownerId", "==", ownerId),
    where("kind", "==", kind),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Memory[];
}

export async function create(input: Omit<Memory, "id" | "createdAt" | "updatedAt">) {
  const payload = { ...input, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
  const res = await addDoc(col, payload as any);
  return res.id;
}

export async function update(id: string, patch: Partial<Memory>) {
  await updateDoc(doc(db, "memories", id), { ...patch, updatedAt: serverTimestamp() } as any);
}

export async function remove(id: string) {
  await deleteDoc(doc(db, "memories", id));
}
