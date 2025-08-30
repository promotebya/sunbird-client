// utils/points.ts
import {
    addDoc,
    collection,
    DocumentData,
    getDocs,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
    where,
} from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';

export type PointSource = 'task' | 'daily' | 'checkin' | 'bonus';

export type Point = {
  id: string;
  ownerId: string;
  pairId: string | null;
  amount: number;
  source: PointSource;
  note?: string;
  taskId?: string | null;
  createdAt?: any; // Firestore Timestamp
};

type AddPointsOpts = {
  source?: PointSource;
  note?: string;
  pairId?: string | null;
  taskId?: string | null;   // <— allow attaching a task
};

const COL = 'points';

/** Append a points record. */
export async function addPoints(
  ownerId: string,
  amount: number,
  opts: AddPointsOpts = {}
) {
  if (!ownerId) throw new Error('addPoints: ownerId required');
  await addDoc(collection(db, COL), {
    ownerId,
    pairId: opts.pairId ?? null,
    amount,
    source: opts.source ?? 'bonus',
    note: opts.note ?? '',
    taskId: opts.taskId ?? null,
    createdAt: serverTimestamp(),
  });
}

/** Live listener (personal and/or shared), newest first. */
export function listenPoints(
  opts: { ownerId?: string; pairId?: string | null },
  cb: (rows: Point[]) => void
) {
  const filters = [];
  if (opts.ownerId) filters.push(where('ownerId', '==', opts.ownerId));
  if (opts.pairId)  filters.push(where('pairId', '==', opts.pairId));

  const q = query(collection(db, COL), ...filters, orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snap) => {
    const rows: Point[] = [];
    snap.forEach((d) => {
      const data = d.data() as DocumentData;
      rows.push({
        id: d.id,
        ownerId: data.ownerId,
        pairId: data.pairId ?? null,
        amount: Number(data.amount) || 0,
        source: (data.source ?? 'bonus') as PointSource,
        note: data.note,
        taskId: data.taskId ?? null,
        createdAt: data.createdAt,
      });
    });
    cb(rows);
  });
}

/** One-shot total points (optionally within a pair). */
export async function getPointsTotal(
  ownerId: string,
  opts?: { pairId?: string | null }
) {
  const filters = [where('ownerId', '==', ownerId)];
  if (opts?.pairId) filters.push(where('pairId', '==', opts.pairId));

  const q = query(collection(db, COL), ...filters, orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);

  let total = 0;
  snap.forEach((d) => {
    const { amount } = d.data() as { amount: number };
    total += Number(amount) || 0;
  });
  return total;
}
