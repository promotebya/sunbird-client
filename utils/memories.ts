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

export type Memory = {
  id?: string;
  ownerId: string;
  pairId?: string | null;
  kind?: "photo" | "text" | "milestone";
  title: string;
  note?: string;
  createdAt?: any;
  updatedAt?: any;
};

const col = collection(db, "memories");

export async function listMemoriesByOwner(ownerId: string) {
  const q = query(col, where("ownerId", "==", ownerId), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Memory[];
}

export async function listMemoriesByPair(pairId: string) {
  const q = query(col, where("pairId", "==", pairId), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Memory[];
}

export async function addMemory(input: Omit<Memory, "id" | "createdAt" | "updatedAt">) {
  const payload = { ...input, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
  const res = await addDoc(col, payload as any);
  return res.id;
}

export async function updateMemory(id: string, patch: Partial<Memory>) {
  await updateDoc(doc(db, "memories", id), { ...patch, updatedAt: serverTimestamp() } as any);
}

export async function deleteMemory(id: string) {
  await deleteDoc(doc(db, "memories", id));
}
