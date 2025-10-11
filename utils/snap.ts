// utils/snap.ts
import {
  onSnapshot,
  type DocumentReference,
  type DocumentSnapshot,
  type Query,
  type QuerySnapshot,
  type Unsubscribe,
} from 'firebase/firestore';

/**
 * Centralized error handler for Firestore listeners.
 * - permission-denied: expected during unlink / access changes → log softly.
 * - failed-precondition: usually missing / building composite index → log softly.
 * - everything else: log as an error so we still notice real issues.
 */
function handleSnapshotError(tag: string) {
  return (err: any) => {
    const code = err?.code ?? '';
    if (code === 'permission-denied') {
      console.warn(`[fs:${tag}] permission-denied — listener removed (likely unlink or rules).`);
      return;
    }
    if (code === 'failed-precondition') {
      console.warn(
        `[fs:${tag}] failed-precondition — likely a missing/building composite index.`,
        err?.message ?? err
      );
      return;
    }
    console.error(`[fs:${tag}] snapshot error:`, err);
  };
}

/**
 * Safe query listener with robust error handling.
 */
export function listenQuery<T = any>(
  q: Query,
  onData: (snap: QuerySnapshot<T>) => void,
  tag: string
): Unsubscribe {
  let unsub: Unsubscribe = () => {};
  unsub = onSnapshot(
    q,
    (snap) => onData(snap as QuerySnapshot<T>),
    handleSnapshotError(tag)
  );
  return () => {
    try { unsub(); } catch {}
  };
}

/**
 * Safe document listener with robust error handling.
 */
export function listenDoc<T = any>(
  ref: DocumentReference<T>,
  onData: (snap: DocumentSnapshot<T>) => void,
  tag: string
): Unsubscribe {
  let unsub: Unsubscribe = () => {};
  unsub = onSnapshot(
    ref,
    (snap) => onData(snap as DocumentSnapshot<T>),
    handleSnapshotError(tag)
  );
  return () => {
    try { unsub(); } catch {}
  };
}