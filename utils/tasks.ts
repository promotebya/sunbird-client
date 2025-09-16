// utils/tasks.ts
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  Unsubscribe,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';

/** Firestore "tasks" document shape */
export type Task = {
  id: string;
  title: string;
  ownerId: string;
  pairId?: string | null;   // present for shared tasks; null/undefined for personal
  done: boolean;
  points?: number;          // optional "reward" points for completing
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
};

/** Minimal input for creating a task */
export type TaskInput = {
  title: string;
  ownerId: string;
  pairId?: string | null;   // pass a pairId to make it "Shared"
  points?: number;          // optional
};

const TASKS = collection(db, 'tasks');

/**
 * Create a new task.
 * - Personal: omit pairId (or pass null)
 * - Shared: pass pairId
 */
export async function addTask(input: TaskInput) {
  const payload = {
    title: input.title.trim(),
    ownerId: input.ownerId,
    pairId: input.pairId ?? null,
    done: false,
    points: input.points ?? 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  const ref = await addDoc(TASKS, payload);
  return ref.id;
}

/**
 * Toggle the `done` state of a task. Returns the new state (`true`/`false`).
 * If you want to award points on completion, do it in the caller after this resolves
 * (you’ll already have the task snapshot here if you need meta).
 */
export async function toggleDone(taskId: string): Promise<boolean> {
  const ref = doc(db, 'tasks', taskId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return false;

  const current = snap.data() as Omit<Task, 'id'>;
  const next = !current.done;

  await updateDoc(ref, {
    done: next,
    updatedAt: serverTimestamp(),
  });

  return next;
}

/** Update a task title */
export async function updateTaskTitle(taskId: string, title: string) {
  const ref = doc(db, 'tasks', taskId);
  await updateDoc(ref, { title: title.trim(), updatedAt: serverTimestamp() });
}

/** Hard-delete a task */
export async function removeTask(taskId: string) {
  await deleteDoc(doc(db, 'tasks', taskId));
}

/** Real-time stream: Personal tasks (owned by `ownerId`). Ordered by `createdAt` desc. */
export function subscribePersonalTasks(
  ownerId: string,
  cb: (tasks: Task[]) => void
): Unsubscribe {
  // Uses composite index: (ownerId, createdAt)
  const q = query(TASKS, where('ownerId', '==', ownerId), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snap) => {
    const items: Task[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
    cb(items);
  });
}

/** Real-time stream: Shared tasks (by `pairId`). Ordered by `createdAt` desc. */
export function subscribeSharedTasks(
  pairId: string,
  cb: (tasks: Task[]) => void
): Unsubscribe {
  // Uses composite index: (pairId, createdAt)
  const q = query(TASKS, where('pairId', '==', pairId), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snap) => {
    const items: Task[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
    cb(items);
  });
}

/**
 * Restore helper for Undo flows (re-creates a deleted task with fresh timestamps).
 * Use this when you want to fully restore the original fields.
 */
export type TaskBackup = {
  title: string;
  ownerId: string;
  pairId?: string | null;
  done?: boolean;
  points?: number;
};

export async function addTaskFromBackup(b: TaskBackup) {
  await addDoc(TASKS, {
    title: (b.title ?? '').trim(),
    ownerId: b.ownerId,
    pairId: b.pairId ?? null,
    done: !!b.done,
    points: b.points ?? 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Utility: fetch a single task (e.g., if you need the current state).
 */
export async function getTask(taskId: string): Promise<Task | null> {
  const ref = doc(db, 'tasks', taskId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as any) } as Task;
}
