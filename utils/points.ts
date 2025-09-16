// utils/points.ts
import {
  addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query,
  serverTimestamp, Timestamp, Unsubscribe, where,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';

export type CreatePointsParams = {
  ownerId: string;
  pairId?: string | null;
  value: number;
  reason?: string;
  taskId?: string | null;
};

export async function createPointsEntry(params: CreatePointsParams): Promise<string> {
  const { ownerId, pairId = null, value, reason = '', taskId = null } = params;
  const ref = await addDoc(collection(db, 'points'), {
    ownerId,
    uid: ownerId,       // compat with existing queries
    pairId,
    value,
    reason,
    taskId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function deletePointsEntry(id: string): Promise<void> {
  await deleteDoc(doc(db, 'points', id));
}

export function listenTotalPoints(
  ownerId: string,
  pairId: string | null | undefined,
  cb: (total: number) => void
): Unsubscribe {
  const base = collection(db, 'points');
  const q = pairId
    ? query(base, where('pairId', '==', pairId), orderBy('createdAt', 'desc'))
    : query(base, where('ownerId', '==', ownerId), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snap) => {
    let sum = 0;
    snap.forEach((d) => { const v = (d.data() as any)?.value ?? 0; if (typeof v === 'number') sum += v; });
    cb(sum);
  });
}

export function startOfWeek(d = new Date()): Date {
  const date = new Date(d);
  const day = (date.getDay() + 6) % 7; // Monday start
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - day);
  return date;
}

export function listenWeekPoints(
  ownerId: string,
  pairId: string | null | undefined,
  cb: (total: number) => void
): Unsubscribe {
  const base = collection(db, 'points');
  const weekStart = Timestamp.fromDate(startOfWeek());
  const q = pairId
    ? query(base, where('pairId', '==', pairId), where('createdAt', '>=', weekStart), orderBy('createdAt', 'desc'))
    : query(base, where('ownerId', '==', ownerId), where('createdAt', '>=', weekStart), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snap) => {
    let sum = 0;
    snap.forEach((d) => { const v = (d.data() as any)?.value ?? 0; if (typeof v === 'number') sum += v; });
    cb(sum);
  });
}
