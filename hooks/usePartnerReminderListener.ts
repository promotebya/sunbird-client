// hooks/usePartnerReminderListener.ts
import * as Notifications from 'expo-notifications';
import {
    collection,
    doc,
    onSnapshot,
    query,
    serverTimestamp,
    updateDoc,
    where,
} from 'firebase/firestore';
import { useEffect } from 'react';
import { db } from '../firebaseConfig';

export default function usePartnerReminderListener(uid: string | null | undefined) {
  useEffect(() => {
    if (!uid) return;

    const q = query(
      collection(db, 'reminders'),
      where('forUid', '==', uid),
      where('status', '==', 'pending')
    );

    const unsub = onSnapshot(q, async (snap) => {
      for (const d of snap.docs) {
        const data = d.data() as { title?: string; dueAt?: string };
        const title = data?.title ?? 'Reminder';
        const dueAtISO = data?.dueAt;
        if (!dueAtISO) continue;

        const dueAt = new Date(dueAtISO);
        if (isNaN(dueAt.getTime())) continue;

        // If due time already passed, mark handled without scheduling
        if (dueAt.getTime() <= Date.now()) {
          await updateDoc(doc(db, 'reminders', d.id), {
            status: 'scheduled',
            scheduledAt: serverTimestamp(),
            localNotificationId: null,
          }).catch(() => {});
          continue;
        }

        try {
          const trigger: Notifications.DateTriggerInput = {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: dueAt,
          };

          const id = await Notifications.scheduleNotificationAsync({
            content: { title: 'Reminder ⏰', body: title, sound: 'default' },
            trigger,
          });

          await updateDoc(doc(db, 'reminders', d.id), {
            status: 'scheduled',
            scheduledAt: serverTimestamp(),
            localNotificationId: id,
          }).catch(() => {});
        } catch {
          // leave as pending to retry next snapshot
        }
      }
    });

    return () => unsub();
  }, [uid]);
}
