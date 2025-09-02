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

export type Task = {
  id?: string;
  ownerId: string;
  pairId?: string | null; // set for shared tasks
  title: string;
  done: boolean;
  createdAt?: any;
  updatedAt?: any;
};

const col = collection(db, "tasks");

export async function listPersonal(ownerId: string) {
  const q = query(
    col,
    where("ownerId", "==", ownerId),
    where("pairId", "==", null),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Task[];
}

export async function listShared(pairId: string) {
  const q = query(col, where("pairId", "==", pairId), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Task[];
}

export async function create(input: Omit<Task, "id" | "done" | "createdAt" | "updatedAt">) {
  const payload = {
    ...input,
    done: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  const res = await addDoc(col, payload as any);
  return res.id;
}

export async function setDone(id: string, done: boolean) {
  await updateDoc(doc(db, "tasks", id), { done, updatedAt: serverTimestamp() });
}

export async function remove(id: string) {
  await deleteDoc(doc(db, "tasks", id));
}
