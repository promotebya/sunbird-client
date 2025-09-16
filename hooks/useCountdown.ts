// hooks/useCountdown.ts
import { useEffect, useMemo, useState } from 'react';

export default function useCountdown(targetISO: string | null | undefined) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!targetISO) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [targetISO]);

  const { remainingMs, expired, label } = useMemo(() => {
    if (!targetISO) return { remainingMs: 0, expired: true, label: '' };
    const target = new Date(targetISO).getTime();
    const diff = Math.max(0, target - now);
    const expired = diff <= 0;

    const totalSec = Math.floor(diff / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;

    const label =
      m > 0 ? `${m}m ${String(s).padStart(2, '0')}s` : `${s}s`;

    return { remainingMs: diff, expired, label };
  }, [now, targetISO]);

  return { remainingMs, expired, label };
}
