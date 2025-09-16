// hooks/usePointsTotal.ts
import { useEffect, useState } from 'react';
import { getPairId } from '../utils/partner';
import { listenTotalPoints, listenWeekPoints } from '../utils/points';

export default function usePointsTotal(uid?: string | null) {
  const [pairId, setPairId] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [weekly, setWeekly] = useState(0);
  const [popped, setPopped] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!uid) return setPairId(null);
      const p = await getPairId(uid);
      if (mounted) setPairId(p ?? null);
    })();
    return () => { mounted = false; };
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    const offTotal = listenTotalPoints(uid, pairId, (t) => {
      setPopped(t > total);
      setTotal(t);
    });
    const offWeek = listenWeekPoints(uid, pairId, (w) => setWeekly(w));
    return () => {
      offTotal && offTotal();
      offWeek && offWeek();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, pairId]);

  return { total, weekly, popped, pairId };
}
