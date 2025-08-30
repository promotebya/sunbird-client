// utils/tasks.ts
import {
    doc,
    serverTimestamp,
    updateDoc,
} from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';
import { addPoints } from './points';

export type Task = {
  id: string;
  ownerId: string;
  title: string;
  points: number;
  pairId?: string | null;
  createdAt?: any;
  completed?: boolean;
  completedAt?: any;
  completedBy?: string;
};

/**
 * Marks a task as completed and awards points to the actor.
 * For shared tasks, whoever taps “Complete” gets the points.
 */
export async function completeTask(task: Task, actorUid: string) {
  const taskRef = doc(db, 'tasks', task.id);

  await updateDoc(taskRef, {
    completed: true,
    completedAt: serverTimestamp(),
    completedBy: actorUid,
  });

  await addPoints(actorUid, task.points, {
    source: 'task',
    taskId: task.id,
    pairId: task.pairId ?? null,
  });
}
