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
  setDoc,
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
  scope?: 'personal' | 'shared';
  kind?: 'personal' | 'shared';
  forUid?: string | null;
};

/* ───────────────────────── helpers ───────────────────────── */

function coerceNumber(v: any): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

// Prefer the reason prefix as the canonical discriminator.
// This makes the system resilient to older/wrong scope/kind flags.
function reasonIsPersonal(reason: any): boolean {
  const r = (typeof reason === 'string' ? reason : '').trim().toLowerCase();
  return r.startsWith('personal task:');
}
function reasonIsShared(reason: any): boolean {
  const r = (typeof reason === 'string' ? reason : '').trim().toLowerCase();
  return r.startsWith('task:'); // how shared awards are created by TasksScreen
}

export function isPersonalMeta(data: any): boolean {
  if (!data || typeof data !== 'object') return false;

  // 1) Reason prefix wins.
  if (reasonIsPersonal(data?.reason)) return true;
  if (reasonIsShared(data?.reason)) return false;

  // 2) Otherwise fall back to explicit flags.
  const scope = typeof data.scope === 'string' ? data.scope.toLowerCase() : '';
  const kind  = typeof data.kind  === 'string' ? data.kind.toLowerCase()  : '';
  if (scope === 'personal' || kind === 'personal') return true;

  // 3) Legacy: forUid present implies personal for a user.
  return data.forUid != null;
}

/* ───────────────────── write & delete ───────────────────── */

export async function createPointsEntry(params: CreatePointsParams): Promise<string> {
  const { ownerId, pairId = null, value, reason = '', taskId = null, scope, kind, forUid = null } = params;

  const data: Record<string, any> = {
    ownerId,
    uid: ownerId, // compat with existing queries/rules
    pairId,
    value,
    reason,
    taskId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  if (scope != null) data.scope = scope;
  if (kind  != null) data.kind  = kind;
  if (forUid!= null) data.forUid = forUid;

  // 1) Create root doc
  const ref = await addDoc(collection(db, 'points'), data);

  // 2) Best-effort mirror with same id
  if (pairId) {
    try {
      await setDoc(doc(db, 'pairs', pairId, 'points', ref.id), {
        ...data,
        pairId,
        mirrorOf: ref.id,
      });
    } catch (e) {
      // Important for debugging if mirroring ever fails
      console.warn('[points] mirror write failed; totals will fall back to root only', e);
    }
  }

  return ref.id;
}

export async function deletePointsEntry(id: string, pairId?: string | null): Promise<void> {
  try { await deleteDoc(doc(db, 'points', id)); } catch {}
  if (pairId) {
    try { await deleteDoc(doc(db, 'pairs', pairId, 'points', id)); } catch {}
  }
}

/* ───────────────────── legacy listeners ──────────────────── */

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
      const v = coerceNumber((d.data() as any)?.value);
      if (v > 0) sum += v;
    });
    cb(sum);
  });
}

export function startOfWeek(d = new Date()): Date {
  const date = new Date(d);
  const day = (date.getDay() + 6) % 7;
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
  const qRef = pairId
    ? query(base, where('pairId', '==', pairId), where('createdAt', '>=', weekStart), orderBy('createdAt', 'desc'))
    : query(base, where('ownerId', '==', ownerId), where('createdAt', '>=', weekStart), orderBy('createdAt', 'desc'));

  return onSnapshot(qRef, (snap) => {
    let sum = 0;
    snap.forEach((d) => {
      const v = coerceNumber((d.data() as any)?.value);
      if (v > 0) sum += v;
    });
    cb(sum);
  });
}

/* ───────────────  dual-source aggregating listeners  ─────────────── */

/**
 * Sum SHARED points for a pair by listening to BOTH root and mirror, de-duping by id.
 * Excludes personal using reason/flags, but **includes shared entries** even if flags were wrong.
 */
export function listenPairSharedPoints(pairId: string, cb: (total: number) => void): Unsubscribe {
  const rootCol   = collection(db, 'points');
  const mirrorCol = collection(db, 'pairs', pairId, 'points');

  let rootMap = new Map<string, any>();
  let mirrorMap = new Map<string, any>();

  const recompute = () => {
    // mirror overrides root if both exist (same id for new entries)
    const merged = new Map<string, any>([...rootMap, ...mirrorMap]);
    let sum = 0;

    for (const data of merged.values()) {
      // if it clearly belongs to another pair, skip (shouldn’t happen for mirror)
      if (data?.pairId != null && data.pairId !== pairId) continue;

      const v = coerceNumber(data?.value);
      if (v <= 0) continue;

      // exclude personal (reason-first heuristic)
      if (isPersonalMeta(data)) continue;

      sum += v;
    }
    cb(sum);
  };

  const unsubRoot = onSnapshot(
    query(rootCol, where('pairId', '==', pairId)),
    (snap) => { rootMap = new Map(snap.docs.map((d) => [d.id, d.data()])); recompute(); },
    ()      => { rootMap = new Map(); recompute(); }
  );

  const unsubMirror = onSnapshot(
    query(mirrorCol),
    (snap) => { mirrorMap = new Map(snap.docs.map((d) => [d.id, d.data()])); recompute(); },
    ()      => { mirrorMap = new Map(); recompute(); }
  );

  return () => { try { unsubRoot(); } catch {} try { unsubMirror(); } catch {} };
}

/**
 * Sum PERSONAL points for `ownerId` within a pair (root + mirror), supporting **legacy shapes**:
 *  - new:  ownerId === recipientUid, forUid === recipientUid
 *  - old:  ownerId === giverUid,     forUid === recipientUid (we must count by forUid)
 */
export function listenOwnerPersonalPointsInPair(
  ownerId: string,
  pairId: string,
  cb: (total: number) => void
): Unsubscribe {
  const rootCol   = collection(db, 'points');
  const mirrorCol = collection(db, 'pairs', pairId, 'points');

  // We maintain FOUR maps to cover root/mirror × (ownerId==uid OR forUid==uid)
  let rootByOwner  = new Map<string, any>();
  let rootByForUid = new Map<string, any>();
  let mirrByOwner  = new Map<string, any>();
  let mirrByForUid = new Map<string, any>();

  const recompute = () => {
    // Merge priority: mirror overrides root if same id
    const merged = new Map<string, any>([
      ...rootByOwner,
      ...rootByForUid,
      ...mirrByOwner,
      ...mirrByForUid,
    ]);

    let sum = 0;
    for (const data of merged.values()) {
      const v = coerceNumber(data?.value);
      if (v <= 0) continue;

      // must belong to this pair; mirror docs are implicitly scoped, but keep check for safety
      if ((data?.pairId ?? pairId) !== pairId) continue;

      // Personal only: by reason/flags, OR legacy forUid
      if (!isPersonalMeta(data)) continue;

      // Make sure it's "mine": either new shape (ownerId===uid) OR legacy (forUid===uid)
      if (data?.ownerId !== ownerId && data?.forUid !== ownerId) continue;

      sum += v;
    }
    cb(sum);
  };

  // ROOT listeners
  const unsubRootOwner = onSnapshot(
    query(rootCol, where('ownerId', '==', ownerId)),
    (snap) => { rootByOwner = new Map(snap.docs.map((d) => [d.id, d.data()])); recompute(); },
    ()      => { rootByOwner = new Map(); recompute(); }
  );
  const unsubRootFor = onSnapshot(
    query(rootCol, where('forUid', '==', ownerId)),
    (snap) => { rootByForUid = new Map(snap.docs.map((d) => [d.id, d.data()])); recompute(); },
    ()      => { rootByForUid = new Map(); recompute(); }
  );

  // MIRROR listeners (scoped to pair)
  const unsubMirrOwner = onSnapshot(
    query(mirrorCol, where('ownerId', '==', ownerId)),
    (snap) => { mirrByOwner = new Map(snap.docs.map((d) => [d.id, d.data()])); recompute(); },
    ()      => { mirrByOwner = new Map(); recompute(); }
  );
  const unsubMirrFor = onSnapshot(
    query(mirrorCol, where('forUid', '==', ownerId)),
    (snap) => { mirrByForUid = new Map(snap.docs.map((d) => [d.id, d.data()])); recompute(); },
    ()      => { mirrByForUid = new Map(); recompute(); }
  );

  return () => {
    try { unsubRootOwner(); } catch {}
    try { unsubRootFor(); }   catch {}
    try { unsubMirrOwner(); } catch {}
    try { unsubMirrFor(); }   catch {}
  };
}

/** unchanged: solo points outside any pair (pairId == null/undefined) */
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
        const v = coerceNumber(data?.value);
        if (v <= 0) continue;
        if (pid === null || pid === undefined) sum += v;
      }
      cb(sum);
    },
    () => cb(0)
  );
}