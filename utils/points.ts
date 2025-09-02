import { db } from "@/firebaseConfig";
import {
    addDoc,
    collection,
    getDocs,
    orderBy,
    query,
    serverTimestamp,
    where,
} from "firebase/firestore";

export type PointEvent = {
  id?: string;
  uid: string;
  pairId?: string | null;
  delta: number; // positive/negative
  reason?: string;
  createdAt?: any;
};

const col = collection(db, "points");

export async function listPointsByUser(uid: string) {
  const q = query(col, where("uid", "==", uid), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as PointEvent[];
}

export async function listPointsByPair(pairId: string) {
  const q = query(col, where("pairId", "==", pairId), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as PointEvent[];
}

export async function addPoints(evt: Omit<PointEvent, "id" | "createdAt">) {
  const payload = { ...evt, createdAt: serverTimestamp() };
  const res = await addDoc(col, payload as any);
  return res.id;
}
