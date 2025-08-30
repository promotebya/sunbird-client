// utils/memories.ts
import * as Notifications from 'expo-notifications';
import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDocs,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
    where,
} from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';
import { AddMemoryInput, Memory, MemoryKind } from '../types';

const coll = collection(db, 'memories');

export async function addMemory(input: AddMemoryInput): Promise<string> {
  const docRef = await addDoc(coll, {
    ...input,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

export function listenMemories(ownerId: string, cb: (items: Memory[]) => void) {
  const q = query(coll, where('ownerId', '==', ownerId), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snap) => {
    const items = snap.docs.map(
      (d) => ({ id: d.id, ...(d.data() as any) } as Memory),
    );
    cb(items);
  });
}

export async function listByKind(ownerId: string, kind: MemoryKind): Promise<Memory[]> {
  const q = query(
    coll,
    where('ownerId', '==', ownerId),
    where('kind', '==', kind),
    orderBy('createdAt', 'desc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) } as Memory));
}

export async function deleteMemory(id: string) {
  await deleteDoc(doc(db, 'memories', id));
}

/* ---------------- Notifications helpers ----------------
   NOTE: we cast triggers to `any` to be compatible across Expo SDKs.
   You still get the correct runtime behaviour.
*/

export async function scheduleOneOff(date: Date, title: string, body?: string) {
  await Notifications.scheduleNotificationAsync({
    content: { title, body },
    // SDKs vary: sometimes `trigger: date` is allowed, sometimes `{ date }`
    // Cast to any for compatibility.
    trigger: { date } as any,
  });
}

export async function scheduleDaily(hour: number, minute: number, title: string, body?: string) {
  await Notifications.scheduleNotificationAsync({
    content: { title, body },
    // Calendar/daily trigger
    trigger: { hour, minute, repeats: true } as any,
  });
}

export async function scheduleInSeconds(seconds: number, title: string, body?: string) {
  await Notifications.scheduleNotificationAsync({
    content: { title, body },
    // Time interval trigger
    trigger: { seconds, repeats: false } as any,
  });
}
