// hooks/usePointsTotal.ts
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  where,
  type DocumentData,
  type FirestoreError,
  type Query,
  type QuerySnapshot,
} from 'firebase/firestore';
import { useEffect, useMemo, useRef, useState } from 'react';
import { db } from '../firebaseConfig';

/* ---------------- helpers ---------------- */

function getPointValue(data: any): number {
  const candidates = [data?.value, data?.points, data?.point, data?.amount, data?.delta, data?.score];
  for (const c of candidates) {
    const n = Number(c);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function getDocDate(data: any): Date | null {
  const fields = ['createdAt', 'timestamp', 'ts', 'time', 'date'];
  for (const k of fields) {
    const v: any = data?.[k];
    if (!v) continue;
    try {
      if (typeof v?.toDate === 'function') {
        const d = v.toDate();
        if (!Number.isNaN(+d)) return d;
      } else if (typeof v === 'number') {
        const ms = v > 1e12 ? v : v * 1000; // support seconds
        const d = new Date(ms);
        if (!Number.isNaN(+d)) return d;
      } else if (typeof v === 'string') {
        const d = new Date(v);
        if (!Number.isNaN(+d)) return d;
      }
    } catch {}
  }
  return null;
}

// Use a stable id across global + subcollection (prefers idempotencyKey)
function dedupeKey(data: any, id: string) {
  return String(data?.idempotencyKey ?? id);
}

/** Monday 00:00 UTC (ISO-week) */
function startOfWeekMondayUTC(d = new Date()) {
  const copy = new Date(d);
  const day = copy.getUTCDay(); // 0=Sun..6=Sat
  const diffToMon = (day + 6) % 7;
  copy.setUTCHours(0, 0, 0, 0);
  copy.setUTCDate(copy.getUTCDate() - diffToMon);
  return copy;
}

// partner UID helper from pair doc with various possible shapes
function extractPartnerUidFromPairDoc(d: any, myUid: string): string | null {
  if (!d) return null;
  if (d.userA && d.userB) return d.userA === myUid ? d.userB : d.userA;
  if (d.ownerId && d.partnerId) return d.ownerId === myUid ? d.partnerId : d.ownerId;
  if (Array.isArray(d.members)) return d.members.find((u: string) => u && u !== myUid) ?? null;
  if (Array.isArray(d.userIds)) return d.userIds.find((u: string) => u && u !== myUid) ?? null;
  if (d.a && d.b) return d.a === myUid ? d.b : d.a;
  return null;
}

/* ---------------- hook ---------------- */

export default function usePointsTotal(uid?: string | null) {
  const [pairId, setPairId] = useState<string | null>(null);
  const [partnerUid, setPartnerUid] = useState<string | null>(null);

  const [total, setTotal] = useState(0);
  const [weekly, setWeekly] = useState(0);
  const [popped, setPopped] = useState(false);

  const prevTotalRef = useRef(0);

  // Live pairId from my user doc (updates immediately on link/unlink)
  useEffect(() => {
    if (!uid) {
      setPairId(null);
      return;
    }
    const uref = doc(db, 'users', uid);
    const off = onSnapshot(
      uref,
      (snap) => {
        const data = snap.data() as any;
        setPairId((data?.pairId as string | null) ?? null);
      },
      () => setPairId(null)
    );
    return () => off();
  }, [uid]);

  // Partner UID from /pairs/{pairId}
  useEffect(() => {
    if (!uid || !pairId) {
      setPartnerUid(null);
      return;
    }
    const pref = doc(db, 'pairs', pairId);
    const off = onSnapshot(
      pref,
      (snap) => {
        if (!snap.exists()) {
          setPartnerUid(null);
          return;
        }
        setPartnerUid(extractPartnerUidFromPairDoc(snap.data(), uid));
      },
      () => setPartnerUid(null)
    );
    return () => off();
  }, [uid, pairId]);

  // WEEKLY: positive values within current ISO week — union of all sources + optional mirror subcollection
  useEffect(() => {
    if (!uid) {
      setWeekly(0);
      return;
    }

    const since = startOfWeekMondayUTC();
    const until = new Date(since);
    until.setUTCDate(until.getUTCDate() + 7);
    const sinceTs = Timestamp.fromDate(since);

    const baseRef = collection(db, 'points');
    const buf = new Map<string, any>();

    const recompute = () => {
      let sum = 0;
      for (const data of buf.values()) {
        const v = getPointValue(data);
        const dt = getDocDate(data);
        if (dt && dt >= since && dt < until && Number.isFinite(v) && v > 0) {
          sum += v;
        }
      }
      setWeekly(sum);
    };

    const unsubs: Array<() => void> = [];

    const add = (qRef: Query<DocumentData>, fbRef?: Query<DocumentData>) =>
      onSnapshot(
        qRef,
        (snap: QuerySnapshot<DocumentData>) => {
          for (const d of snap.docs) buf.set(dedupeKey(d.data(), d.id), d.data());
          recompute();
        },
        (_err: FirestoreError) => {
          // fallback (no createdAt index or offline)
          if (!fbRef) return;
          const off = onSnapshot(fbRef, (snap2) => {
            for (const d of snap2.docs) buf.set(dedupeKey(d.data(), d.id), d.data());
            recompute();
          });
          unsubs.push(off);
        }
      );

    // mine
    unsubs.push(
      add(
        query(baseRef, where('ownerId', '==', uid), where('createdAt', '>=', sinceTs), orderBy('createdAt', 'desc')),
        query(baseRef, where('ownerId', '==', uid))
      )
    );

    // shared pair docs (root)
    if (pairId) {
      unsubs.push(
        add(
          query(baseRef, where('pairId', '==', pairId), where('createdAt', '>=', sinceTs), orderBy('createdAt', 'desc')),
          query(baseRef, where('pairId', '==', pairId))
        )
      );
    }

    // partner legacy owner-only
    if (partnerUid) {
      unsubs.push(
        add(
          query(baseRef, where('ownerId', '==', partnerUid), where('createdAt', '>=', sinceTs), orderBy('createdAt', 'desc')),
          query(baseRef, where('ownerId', '==', partnerUid))
        )
      );
    }

    // optional mirror subcollection: /pairs/{pairId}/points
    if (pairId) {
      const offSub = onSnapshot(collection(db, 'pairs', pairId, 'points'), (snap) => {
        for (const d of snap.docs) buf.set(dedupeKey(d.data(), d.id), d.data());
        recompute();
      });
      unsubs.push(offSub);
    }

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [uid, pairId, partnerUid]);

  // TOTAL: net sum (includes negatives) — union of all sources + optional mirror
  useEffect(() => {
    if (!uid) {
      setTotal(0);
      setPopped(false);
      prevTotalRef.current = 0;
      return;
    }

    const baseRef = collection(db, 'points');
    const buf = new Map<string, any>();

    const recompute = () => {
      let sum = 0;
      for (const data of buf.values()) {
        const v = getPointValue(data);
        if (Number.isFinite(v)) sum += v;
      }
      const prev = prevTotalRef.current;
      setPopped(sum > prev);
      prevTotalRef.current = sum;
      setTotal(sum);
    };

    const unsubs: Array<() => void> = [];

    const add = (qRef: Query<DocumentData>) =>
      onSnapshot(qRef, (snap) => {
        for (const d of snap.docs) buf.set(dedupeKey(d.data(), d.id), d.data());
        recompute();
      });

    // mine
    unsubs.push(add(query(baseRef, where('ownerId', '==', uid))));
    // partner legacy
    if (partnerUid) unsubs.push(add(query(baseRef, where('ownerId', '==', partnerUid))));
    // shared pair (root points)
    if (pairId) unsubs.push(add(query(baseRef, where('pairId', '==', pairId))));
    // optional mirror subcollection: /pairs/{pairId}/points
    if (pairId) {
      const offSub = onSnapshot(collection(db, 'pairs', pairId, 'points'), (snap) => {
        for (const d of snap.docs) buf.set(dedupeKey(d.data(), d.id), d.data());
        recompute();
      });
      unsubs.push(offSub);
    }

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [uid, pairId, partnerUid]);

  return useMemo(() => ({ total, weekly, popped, pairId }), [total, weekly, popped, pairId]);
}