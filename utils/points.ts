// utils/points.ts
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  Unsubscribe,
  where,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';

export type CreatePointsParams = {
  ownerId: string;
  value: number;
  pairId?: string | null;
  reason?: string | null;
  taskId?: string | null;

  // Metadata used by personal/shared balances
  scope?: 'personal' | 'shared';
  kind?: 'personal' | 'shared';
  forUid?: string | null;
};

export async function createPointsEntry(params: CreatePointsParams): Promise<string> {
  const {
    ownerId,
    pairId = null,
    value,
    reason = '',
    taskId = null,
    scope,
    kind,
    forUid = null,
  } = params;

  // Firestore rejects undefined values, so build the payload conditionally.
  const data: Record<string, any> = {
    ownerId,
    uid: ownerId, // compat with existing queries
    pairId,
    value,
    reason,
    taskId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (scope != null) data.scope = scope;     // only add if defined
  if (kind != null) data.kind = kind;        // only add if defined
  if (forUid != null) data.forUid = forUid;  // only add if defined

  const ref = await addDoc(collection(db, 'points'), data);
  return ref.id;
}

export async function deletePointsEntry(id: string): Promise<void> {
  await deleteDoc(doc(db, 'points', id));
}

/** Helper to detect if a point entry should count as "personal". */
export function isPersonalMeta(data: any): boolean {
  const scope = data?.scope;
  const kind = data?.kind;
  const reason = String(data?.reason ?? '').toLowerCase();
  return scope === 'personal' || kind === 'personal' || reason.includes('personal task');
}

/** Legacy total points listener (kept for backward-compat). */
export function listenTotalPoints(
  ownerId: string,
  pairId: string | null | undefined,
  cb: (total: number) => void
): Unsubscribe {
  const base = collection(db, 'points');
  const qRef = pairId
    ? query(base, where('pairId', '==', pairId), orderBy('createdAt', 'desc'))
    : query(base, where('ownerId', '==', ownerId), orderBy('createdAt', 'desc'));

  return onSnapshot(qRef, (snap) => {
    let sum = 0;
    snap.forEach((d) => {
      const v = Number((d.data() as any)?.value ?? 0);
      if (Number.isFinite(v) && v > 0) sum += v; // defensive: positive only
    });
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

/** Legacy week listener (kept for backward-compat). */
export function listenWeekPoints(
  ownerId: string,
  pairId: string | null | undefined,
  cb: (total: number) => void
): Unsubscribe {
  const base = collection(db, 'points');
  const weekStart = Timestamp.fromDate(startOfWeek());

  const qRef = pairId
    ? query(base, where('pairId', '==', pairId), where('createdAt', '>=', weekStart), orderBy('createdAt', 'desc'))
    : query(base, where('ownerId', '==', ownerId), where('createdAt', '>=', weekStart), orderBy('createdAt', 'desc'));

  return onSnapshot(qRef, (snap) => {
    let sum = 0;
    snap.forEach((d) => {
      const v = Number((d.data() as any)?.value ?? 0);
      if (Number.isFinite(v) && v > 0) sum += v; // defensive: positive only
    });
    cb(sum);
  });
}

/** Sum only SHARED points for a given pair (excludes personal-marked entries). */
export function listenPairSharedPoints(pairId: string, cb: (total: number) => void): Unsubscribe {
  const base = collection(db, 'points');
  const qRef = query(base, where('pairId', '==', pairId));

  return onSnapshot(
    qRef,
    (snap) => {
      let sum = 0;
      for (const d of snap.docs) {
        const data: any = d.data();
        const v = Number(data?.value ?? 0);
        if (!Number.isFinite(v) || v <= 0) continue;
        if (isPersonalMeta(data)) continue; // exclude personal
        sum += v;
      }
      cb(sum);
    },
    () => cb(0)
  );
}

/** Sum only PERSONAL points that belong to `ownerId` within a given pair. */
export function listenOwnerPersonalPointsInPair(
  ownerId: string,
  pairId: string,
  cb: (total: number) => void
): Unsubscribe {
  const base = collection(db, 'points');
  // Query by ownerId, then filter locally by pairId to avoid composite index requirements
  const qRef = query(base, where('ownerId', '==', ownerId));

  return onSnapshot(
    qRef,
    (snap) => {
      let sum = 0;
      for (const d of snap.docs) {
        const data: any = d.data();
        if (data?.pairId !== pairId) continue;
        const v = Number(data?.value ?? 0);
        if (!Number.isFinite(v) || v <= 0) continue;
        if (!isPersonalMeta(data)) continue; // include only personal
        sum += v;
      }
      cb(sum);
    },
    () => cb(0)
  );
}

/** Optional: user’s points that are NOT tied to any pair. */
export function listenOwnerSoloPoints(ownerId: string, cb: (total: number) => void): Unsubscribe {
  const base = collection(db, 'points');
  const qRef = query(base, where('ownerId', '==', ownerId));

  return onSnapshot(
    qRef,
    (snap) => {
      let sum = 0;
      for (const d of snap.docs) {
        const data: any = d.data();
        const pid = data?.pairId ?? null;
        const v = Number(data?.value ?? 0);
        if (!Number.isFinite(v) || v <= 0) continue;
        if (pid === null || pid === undefined) sum += v;
      }
      cb(sum);
    },
    () => cb(0)
  );
}