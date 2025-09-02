import {
    addDoc,
    collection,
    getDocs,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
    where,
} from "firebase/firestore";
import { db } from "../firebaseConfig";

export type PointEvent = {
  id?: string;
  uid: string;
  pairId?: string | null;
  delta: number; // positive/negative
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

/** Sum of points for a user or a pair. */
export async function getPointsTotal(opts: { uid?: string; pairId?: string }) {
  let qRef;
  if (opts.pairId) qRef = query(col, where("pairId", "==", opts.pairId));
  else if (opts.uid) qRef = query(col, where("uid", "==", opts.uid));
  else return 0;

  const snap = await getDocs(qRef);
  return snap.docs.reduce((sum, d) => sum + (d.data().delta || 0), 0);
}

/** Live updates for points list (newest first). Returns unsubscribe. */
export function listenPoints(
  opts: { uid?: string; pairId?: string },
  handler: (events: PointEvent[]) => void
) {
  let qRef;
  if (opts.pairId) qRef = query(col, where("pairId", "==", opts.pairId), orderBy("createdAt", "desc"));
  else if (opts.uid) qRef = query(col, where("uid", "==", opts.uid), orderBy("createdAt", "desc"));
  else throw new Error("listenPoints requires uid or pairId");

  return onSnapshot(qRef, (snap) => {
    handler(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as PointEvent[]);
  });
}
