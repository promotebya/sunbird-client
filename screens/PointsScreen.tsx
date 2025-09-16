// screens/PointsScreen.tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import React, { useEffect, useMemo, useState } from 'react';
import { LayoutAnimation, Platform, StyleSheet, View } from 'react-native';

import Card from '../components/Card';
import ConfettiTiny from '../components/ConfettiTiny';
import EmptyState from '../components/EmptyState';
import Screen from '../components/Screen';
import ThemedText from '../components/ThemedText';
import { tokens } from '../components/tokens';

import { db } from '../firebaseConfig';
import useAuthListener from '../hooks/useAuthListener';
import { getPairId } from '../utils/partner';

type PointsDoc = {
  id: string;
  ownerId: string;
  pairId?: string | null;
  value: number; // positive or negative
  reason?: string | null;
  taskId?: string | null;
  createdAt?: any; // Firestore Timestamp
};

const MILESTONES = [5, 10, 20, 50, 100, 200, 300, 500];

const PointsScreen: React.FC = () => {
  const nav = useNavigation<any>();
  const { user } = useAuthListener();

  const [pairId, setPairId] = useState<string | null>(null);
  const [items, setItems] = useState<PointsDoc[]>([]);
  const [pairTotal, setPairTotal] = useState<number | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    (async () => {
      if (!user) return;
      setPairId(await getPairId(user.uid));
    })();
  }, [user]);

  // personal feed (ownerId == me)
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'points'),
      where('ownerId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    const off = onSnapshot(
      q,
      (snap) => {
        const list: PointsDoc[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<PointsDoc, 'id'>),
        }));
        setItems(list);
        if (Platform.OS === 'android') {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        }
      },
      (err) => {
        console.warn('[SNAP ERR points]', err);
      }
    );
    return () => off();
  }, [user]);

  // optional: read pair total aggregate if present
  useEffect(() => {
    (async () => {
      try {
        if (!pairId) {
          setPairTotal(null);
          return;
        }
        const ref = doc(db, 'pairTotals', pairId);
        const snap = await getDoc(ref);
        setPairTotal(snap.exists() ? ((snap.data() as any).total as number) ?? 0 : null);
      } catch (e) {
        console.warn('[READ ERR pairTotals]', e);
      }
    })();
  }, [pairId]);

  const totalMine = useMemo(
    () => items.reduce((sum, it) => sum + (Number(it.value) || 0), 0),
    [items]
  );

  // This week’s points
  const weekCount = useMemo(() => {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return items
      .filter((it) => {
        const t: Date | undefined = it.createdAt?.toDate?.();
        return t && t >= weekAgo;
      })
      .reduce((s, it) => s + (Number(it.value) || 0), 0);
  }, [items]);

  // Next milestone/progress
  const nextMilestone = useMemo(
    () => MILESTONES.find((m) => m > totalMine) ?? MILESTONES[MILESTONES.length - 1],
    [totalMine]
  );
  const prevMilestone = useMemo(() => {
    const before = MILESTONES.filter((m) => m <= totalMine);
    return before.length ? before[before.length - 1] : 0;
  }, [totalMine]);
  const progressPct = useMemo(() => {
    const span = nextMilestone - prevMilestone || 1;
    const pct = ((totalMine - prevMilestone) / span) * 100;
    return Math.max(0, Math.min(100, pct));
  }, [totalMine, prevMilestone, nextMilestone]);

  // Motivational blurb
  const blurb = useMemo(() => {
    if (totalMine === 0) return 'Every little act counts. Start with one today ✨';
    if (totalMine < 5) return 'Nice start! Tiny kindness adds up 💗';
    if (totalMine < 10) return 'You’re on a roll — keep the momentum! 🔥';
    if (totalMine < 20) return 'Consistency is your superpower 🦸';
    if (totalMine < 50) return 'Love legend in the making 🙌';
    return 'Icon status unlocked. Keep shining 💫';
  }, [totalMine]);

  // Confetti once per milestone crossed
  useEffect(() => {
    if (!user) return;
    const KEY = `lp:last-milestone:${user.uid}`;
    (async () => {
      const saved = await AsyncStorage.getItem(KEY);
      const last = saved ? Number(saved) : 0;
      const crossed = MILESTONES.filter((m) => m <= totalMine).pop() ?? 0;
      if (crossed > (Number.isFinite(last) ? last : 0)) {
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 1200);
        await AsyncStorage.setItem(KEY, String(crossed));
      }
    })();
  }, [totalMine, user]);

  // Recent 5 entries
  const recent = useMemo(() => items.slice(0, 5), [items]);

  return (
    <Screen>
      {showConfetti ? <ConfettiTiny /> : null}

      {/* Header */}
      <View style={styles.headerRow}>
        <ThemedText variant="display">Points</ThemedText>
      </View>

      {/* Summary / motivation / progress */}
      <Card>
        <View style={styles.summaryRow}>
          <View style={{ flex: 1 }}>
            <ThemedText variant="subtitle">You</ThemedText>
            <ThemedText variant="display" color={tokens.colors.primary}>
              {totalMine}
            </ThemedText>
            <ThemedText variant="body" color={tokens.colors.textDim} style={{ marginTop: 4 }}>
              {blurb}
            </ThemedText>
            {pairTotal != null ? (
              <ThemedText variant="caption" color={tokens.colors.textDim} style={{ marginTop: 4 }}>
                Pair total: {pairTotal}
              </ThemedText>
            ) : null}
          </View>

          <View style={{ flex: 1 }}>
            <ThemedText variant="label" color={tokens.colors.textDim}>
              Next milestone
            </ThemedText>
            <ThemedText variant="title" style={{ marginBottom: 8 }}>
              {nextMilestone} pts
            </ThemedText>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
            </View>
            <ThemedText variant="caption" color={tokens.colors.textDim} style={{ marginTop: 6 }}>
              {Math.max(0, nextMilestone - totalMine)} to go • {weekCount} this week
            </ThemedText>
          </View>
        </View>
      </Card>

      {/* History or empty state */}
      {items.length === 0 ? (
        <EmptyState
          title="No points yet"
          body="Complete a task to earn your first point!"
          cta={
            <Card onPress={() => nav.navigate('Tasks')}>
              <ThemedText variant="button">Open Tasks</ThemedText>
            </Card>
          }
        />
      ) : (
        <Card style={{ marginTop: tokens.spacing.md }}>
          <ThemedText variant="h2" style={{ marginBottom: tokens.spacing.s }}>
            Recent
          </ThemedText>
          <View style={{ rowGap: tokens.spacing.s as number }}>
            {recent.map((item) => {
              const sign = item.value > 0 ? '+' : '';
              const when: Date | undefined = item.createdAt?.toDate?.();
              return (
                <View key={item.id} style={styles.rowBetween}>
                  <ThemedText variant="title">
                    {sign}
                    {item.value}
                  </ThemedText>
                  <View style={{ flex: 1, marginLeft: tokens.spacing.md }}>
                    <ThemedText variant="body">{item.reason ?? 'Points'}</ThemedText>
                    <ThemedText variant="caption" color={tokens.colors.textDim} style={{ marginTop: 2 }}>
                      {when ? timeAgo(when) : ''}
                    </ThemedText>
                  </View>
                </View>
              );
            })}
          </View>
        </Card>
      )}
    </Screen>
  );
};

function timeAgo(d: Date) {
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min${m === 1 ? '' : 's'} ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  return d.toLocaleDateString();
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spacing.md as number,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tokens.spacing.md as number,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: '#E5E7EB',
    overflow: 'hidden',
  },
  progressFill: {
    height: 10,
    borderRadius: 999,
    backgroundColor: tokens.colors.primary,
  },
});

export default PointsScreen;
