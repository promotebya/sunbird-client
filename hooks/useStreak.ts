// hooks/useStreak.ts
import { useEffect, useState } from 'react';
import { listenStreak, StreakDoc } from '../utils/streak';

export default function useStreak(uid?: string | null) {
  const [streak, setStreak] = useState<StreakDoc | null>(null);
  useEffect(() => {
    if (!uid) return;
    const off = listenStreak(uid, setStreak);
    return () => off && off();
  }, [uid]);
  return streak;
}
