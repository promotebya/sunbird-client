// utils/memories.ts
import * as Notifications from 'expo-notifications';
import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDocs,
    orderBy,
    query,
    serverTimestamp,
    updateDoc,
    where,
} from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';
import type { Memory, MemoryKind, MemoryReminder, NewMemory } from '../types';

/* Collection ref */
const coll = collection(db, 'memories');

/* ---------- Notification helpers ---------- */

async function scheduleReminder(rem?: MemoryReminder): Promise<string | undefined> {
  if (!rem || rem.type === 'none') return undefined;

  // Ask once for permissions (no-op if already granted)
  const settings = await Notifications.getPermissionsAsync();
  if (!settings.granted) {
    const req = await Notifications.requestPermissionsAsync();
    if (!req.granted) return undefined;
  }

  // Build the trigger in the shape expo-notifications expects (no 'type' field)
  let trigger: Notifications.NotificationTriggerInput;

  if (rem.type === 'date' && rem.date) {
    trigger = new Date(rem.date);
  } else if (rem.type === 'interval' && rem.seconds) {
    trigger = { seconds: rem.seconds, repeats: rem.repeats ?? true } satisfies Notifications.TimeIntervalTriggerInput;
  } else if (rem.type === 'daily' && rem.hour !== undefined && rem.minute !== undefined) {
    trigger = { hour: rem.hour, minute: rem.minute, repeats: true } satisfies Notifications.DailyTriggerInput;
  } else {
    return undefined;
  }

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Memory reminder',
      body: 'Time to reflect ❤️',
      sound: true,
    },
    trigger,
  });

  return id;
}

async function cancelReminder(notificationId?: string) {
  if (notificationId) {
    try {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
    } catch {
      // ignore
    }
  }
}

/* ---------- CRUD ---------- */

// Create: util adds ownerId & createdAt; returns Memory
export async function addMemory(ownerId: string, data: NewMemory): Promise<Memory> {
  // schedule (if any)
  const notificationId = await scheduleReminder(data.reminder);

  const record = {
    ...data,
    ownerId,
    createdAt: Date.now(),
    // store only the notificationId back on reminder
    reminder: data.reminder ? { ...data.reminder, notificationId } : undefined,
    // server timestamp for ordering consistency
    createdAtServer: serverTimestamp(),
  };

  const ref = await addDoc(coll, record);
  const mem: Memory = {
    id: ref.id,
    ownerId,
    kind: data.kind,
    label: data.label,
    value: data.value,
    notes: data.notes,
    link: data.link,
    favorite: data.favorite ?? false,
    createdAt: record.createdAt,
    reminder: record.reminder,
  };

  return mem;
}

export async function deleteMemory(id: string, reminder?: MemoryReminder) {
  await cancelReminder(reminder?.notificationId);
  await deleteDoc(doc(coll, id));
}

export async function toggleFavorite(id: string, value: boolean) {
  await updateDoc(doc(coll, id), { favorite: value });
}

// List by kind for a user
export async function listByKind(ownerId: string, kind: MemoryKind): Promise<Memory[]> {
  const q = query(
    coll,
    where('ownerId', '==', ownerId),
    where('kind', '==', kind),
    orderBy('createdAt', 'desc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as Memory[];
}
