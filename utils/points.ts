import { db } from "@/firebaseConfig";
import {
    addDoc, collection, getDocs, onSnapshot, orderBy, query, serverTimestamp, where,
} from "firebase/firestore";

export type PointEvent = {
  id?: string;
  uid: string;
  pairId?: string | null;
  delta: number;
  reason?: string;
  createdAt?: any;
};

const col = collection(db, "points");

export async function listByUser(uid: string) {
  const q = query(col, where("uid", "==", uid), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as PointEvent[];
}

export async function listByPair(pairId: string) {
  const q = query(col, where("pairId", "==", pairId), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as PointEvent[];
}

export async function add(input: Omit<PointEvent, "id" | "createdAt">) {
  const payload = { ...input, createdAt: serverTimestamp() };
  const res = await addDoc(col, payload as any);
  return res.id;
}

// === Adapters expected by your screens ===
export async function getPointsTotal(opts: { uid?: string; pairId?: string }) {
  let q;
  if (opts.pairId) q = query(col, where("pairId", "==", opts.pairId));
  else if (opts.uid) q = query(col, where("uid", "==", opts.uid));
  else return 0;

  const snap = await getDocs(q);
  return snap.docs.reduce((sum, d) => sum + (d.data().delta || 0), 0);
}

export function listenPoints(
  opts: { uid?: string; pairId?: string },
  handler: (events: PointEvent[]) => void
) {
  let q;
  if (opts.pairId) q = query(col, where("pairId", "==", opts.pairId), orderBy("createdAt", "desc"));
  else if (opts.uid) q = query(col, where("uid", "==", opts.uid), orderBy("createdAt", "desc"));
  else throw new Error("listenPoints requires uid or pairId");

  return onSnapshot(q, (snap) => {
    handler(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as PointEvent[]);
  });
}
