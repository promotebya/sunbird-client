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

export type Task = {
  id?: string;
  ownerId: string;
  pairId?: string | null; // set if shared
  title: string;
  done: boolean;
  createdAt?: any;
  updatedAt?: any;
};

const col = collection(db, "tasks");

export async function listPersonalTasks(ownerId: string) {
  const q = query(
    col,
    where("ownerId", "==", ownerId),
    where("pairId", "==", null),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Task[];
}

export async function listSharedTasks(pairId: string) {
  const q = query(col, where("pairId", "==", pairId), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Task[];
}

export async function addTask(input: Omit<Task, "id" | "done" | "createdAt" | "updatedAt">) {
  const payload = {
    ...input,
    done: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  const res = await addDoc(col, payload as any);
  return res.id;
}

export async function toggleTask(id: string, done: boolean) {
  await updateDoc(doc(db, "tasks", id), { done, updatedAt: serverTimestamp() });
}

export async function deleteTask(id: string) {
  await deleteDoc(doc(db, "tasks", id));
}
