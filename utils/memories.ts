// utils/memories.ts
import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Unsubscribe,
  where,
} from 'firebase/firestore';
import { getDownloadURL, getStorage, ref, uploadBytes } from 'firebase/storage';
import { db } from '../firebaseConfig';

export type MemoryKind = 'text' | 'milestone' | 'photo';

export type MemoryDoc = {
  id: string;
  ownerId: string;
  pairId?: string | null;
  kind: MemoryKind;
  title?: string | null;
  note?: string | null;
  photoURL?: string | null;
  storagePath?: string | null; // where the image lives in Storage (optional)
  clientTag?: string | null;
  createdAt?: any;
};

// Helper for Storage filenames
const rid = () => `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

/**
 * Subscribe to memories. If a pairId is provided, shows the shared feed;
 * otherwise shows only the user's own memories.
 *
 * Hardened to tear down quietly on permission changes (e.g., unlink).
 */
export function subscribeMemories(
  uid: string,
  opts: { pairId?: string | null } | {},
  onData: (items: MemoryDoc[]) => void
): Unsubscribe {
  const pairId = (opts as any)?.pairId ?? null;

  // If we don't have a scope yet, return a no-op unsub and clear UI.
  if (!uid || (!pairId && uid.length === 0)) {
    onData([]);
    return () => {};
  }

  const col = collection(db, 'memories');
  const q = pairId
    ? query(col, where('pairId', '==', pairId), orderBy('createdAt', 'desc'))
    : query(col, where('ownerId', '==', uid), orderBy('createdAt', 'desc'));

  let unsub: Unsubscribe = () => {};
  unsub = onSnapshot(
    q,
    (snap) => {
      const list: MemoryDoc[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as any),
      }));
      onData(list);
    },
    (err: any) => {
      if (err?.code === 'permission-denied') {
        // Access revoked mid-stream (likely unlinked) — stop and clear.
        try { unsub(); } catch {}
        onData([]);
        return;
      }
      console.warn('[memories] snapshot error:', err);
    }
  );

  return () => {
    try { unsub(); } catch {}
  };
}

/**
 * Create a memory.
 * - If `photoUri` is provided, uploads to Storage under:
 *     - memories/{pairId}/{ownerId}/{id}.jpg  (paired)
 *     - memories-solo/{ownerId}/{id}.jpg      (not paired)
 *   and sets `photoURL` automatically.
 * - If you already have a `photoURL`, you may pass it instead of `photoUri`.
 */
export async function createMemory(input: {
  ownerId: string;
  pairId?: string | null;
  kind: MemoryKind;
  title?: string | null;
  note?: string | null;
  photoURL?: string | null;   // already uploaded
  photoUri?: string | null;   // local file to upload
  clientTag?: string | null;
}) {
  const {
    ownerId,
    pairId = null,
    kind,
    title = null,
    note = null,
    photoURL: photoURLIn = null,
    photoUri = null,
    clientTag = null,
  } = input;

  let photoURL = photoURLIn ?? null;
  let storagePath: string | null = null;

  if (!photoURL && photoUri) {
    const storage = getStorage();
    const base = pairId ? `memories/${pairId}/${ownerId}` : `memories-solo/${ownerId}`;
    storagePath = `${base}/${rid()}.jpg`;

    const res = await fetch(photoUri);
    const blob = await res.blob();

    const r = ref(storage, storagePath);
    await uploadBytes(r, blob, { contentType: 'image/jpeg' });
    photoURL = await getDownloadURL(r);
  }

  await addDoc(collection(db, 'memories'), {
    ownerId,
    pairId,
    kind,
    title,
    note,
    photoURL,
    storagePath,
    clientTag,
    createdAt: serverTimestamp(),
  });
}