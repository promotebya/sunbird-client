// utils/snap.ts
import {
    onSnapshot,
    type DocumentReference,
    type DocumentSnapshot,
    type Query,
    type QuerySnapshot,
    type Unsubscribe,
} from 'firebase/firestore';

export function listenQuery<T = any>(
  q: Query,
  onData: (snap: QuerySnapshot<T>) => void,
  tag: string
): Unsubscribe {
  return onSnapshot(
    q,
    (snap) => onData(snap as QuerySnapshot<T>),
    (err) => console.warn(`[SNAP ERR ${tag}]`, err)
  );
}

export function listenDoc<T = any>(
  ref: DocumentReference<T>,
  onData: (snap: DocumentSnapshot<T>) => void,
  tag: string
): Unsubscribe {
  return onSnapshot(
    ref,
    (snap) => onData(snap as DocumentSnapshot<T>),
    (err) => console.warn(`[SNAP ERR ${tag}]`, err)
  );
}
  