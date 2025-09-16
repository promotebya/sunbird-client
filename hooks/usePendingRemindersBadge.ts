// hooks/usePendingRemindersBadge.ts
import { useEffect, useState } from 'react';
import { subscribePendingRemindersCount } from '../utils/reminders';

export default function usePendingRemindersBadge(uid: string | null | undefined) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!uid) {
      setCount(0);
      return;
    }
    const unsub = subscribePendingRemindersCount(uid, setCount);
    return () => unsub && unsub();
  }, [uid]);

  // Cap the badge for aesthetics; React Navigation accepts number | string
  const badge: number | string | undefined = count <= 0 ? undefined : count > 9 ? '9+' : count;

  return { count, badge };
}
