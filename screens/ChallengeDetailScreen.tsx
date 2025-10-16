// screens/ChallengeDetailScreen.tsx
import { RouteProp, useRoute } from '@react-navigation/native';
import { useMemo, useState } from 'react';
import { DeviceEventEmitter, Image, ScrollView, StyleSheet, View } from 'react-native';
import Button from '../components/Button';
import Card from '../components/Card';
import ThemedText from '../components/ThemedText';
import { tokens } from '../components/tokens';
import useAuthListener from '../hooks/useAuthListener';
import { Challenge, useChallenges } from '../hooks/useChallenges';
import { usePro } from '../utils/subscriptions';

// Firestore
import {
  doc,
  increment,
  serverTimestamp,
  setDoc,
  updateDoc
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { getPairId } from '../utils/partner';

type Params = {
  challenge: Challenge;
  status: 'locked' | 'unlocked' | 'in_progress' | 'completed';
  completionChannel?: string; // e.g. 'lp.challenge.completed'
  seed?: any;                 // if you navigate with a "seed" object instead of "challenge"
  pairId?: string | null;     // (optional) pass through from ChallengesScreen for reliability
};

// ISO week key (Mon-based) like 2025-W42 (UTC)
function weekKeyUTC(d = new Date()) {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = (date.getUTCDay() + 6) % 7; // Mon..Sun
  date.setUTCDate(date.getUTCDate() - day + 3); // Thu anchor
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const firstDay = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDay + 3);
  const weekNo = 1 + Math.round((date.getTime() - firstThursday.getTime()) / (7 * 24 * 3600 * 1000));
  const year = date.getUTCFullYear();
  return `${year}-W${String(weekNo).padStart(2, '0')}`;
}

export default function ChallengeDetailScreen() {
  const route = useRoute<RouteProp<Record<string, Partial<Params>>, string>>();
  const { user } = useAuthListener();
  const { hasPro } = usePro();

  const [submitting, setSubmitting] = useState(false);

  // Accept both legacy `challenge` and optional `seed` (from Challenges list)
  const base: Challenge = (route.params?.challenge as Challenge) ?? (route.params?.seed as Challenge);
  const startingStatus = (route.params?.status as Params['status']) ?? 'unlocked';

  const { myStatuses, mark } = useChallenges(user?.uid, 0, hasPro);
  const status = useMemo(
    () => myStatuses.find((s) => s.id === base.id)?.status ?? startingStatus,
    [myStatuses, base?.id, startingStatus]
  );

  const completionChannel =
    (route.params?.completionChannel as string) || 'lp.challenge.completed';

  async function onStart() {
    await mark(base.id, 'in_progress');
  }

  async function onComplete() {
    if (submitting) return;
    setSubmitting(true);
    try {
      await mark(base.id, 'completed');

      // Pick points (+ fallback if seed lacks an explicit value)
      const fallbackPoints =
        typeof (base as any)?.points === 'number'
          ? Number((base as any).points)
          : Math.max(1, Number((base as any)?.tier ?? 1)) * 2;

      const pts = Number.isFinite(fallbackPoints) ? fallbackPoints : 2;

      // Resolve pairId (prefer from route -> then util)
      let pid: string | null = null;
      try {
        pid = (route.params?.pairId as string | null) ?? null;
        if (!pid && user?.uid) pid = await getPairId(user.uid);
      } catch {
        pid = null;
      }

      // A stable idempotency key so a repeated tap cannot double-insert
      const idempotencyKey = `challenge:${pid ?? 'solo'}:${user?.uid ?? 'nouser'}:${base.id}`;

      // 1) Optimistic UI bump (Home/Challenges listeners)
      DeviceEventEmitter.emit(completionChannel, {
        challengeId: base.id,
        points: pts,
        title: base.title,
        idempotencyKey,
      });

      // 2) Persist the point to shared pair stream (and owner fallback)
      // Use setDoc with a stable doc id so we can’t double create the same entry.
      const now = serverTimestamp();
      const common = {
        ownerId: user?.uid ?? null,
        pairId: pid ?? null,
        value: pts,
        reason: `Challenge: ${base.title ?? 'Challenge'}`,
        source: 'challenge',
        challengeId: base.id ?? null,
        idempotencyKey,
        createdAt: now,
      };

      const writes: Promise<any>[] = [];

      // Primary record in global /points with a deterministic id
      writes.push(setDoc(doc(db, 'points', idempotencyKey), common));

      // Mirror into /pairs/{pairId}/points for any screens reading that subcollection
      if (pid) {
        writes.push(setDoc(doc(db, 'pairs', pid, 'points', idempotencyKey), common));

        // Also bump pair aggregates atomically so both devices stay in sync
        const wk = weekKeyUTC(new Date());
        writes.push(
          updateDoc(doc(db, 'pairs', pid), {
            totalPoints: increment(pts),
            totalPointsUpdatedAt: now,
          }).catch(() => {
            // If the doc doesn't exist yet, create it with setDoc
            return setDoc(
              doc(db, 'pairs', pid),
              { totalPoints: pts, totalPointsUpdatedAt: now },
              { merge: true }
            );
          })
        );

        // Weekly bucket (used by Home weekly goals)
        writes.push(
          setDoc(
            doc(db, 'pairs', pid, 'weekly', wk),
            { points: increment(pts), weekKey: wk, updatedAt: now },
            { merge: true }
          )
        );
      }

      await Promise.all(writes);
    } finally {
      setSubmitting(false);
    }
  }

  const locked = status === 'locked';

  return (
    <ScrollView contentContainerStyle={{ padding: tokens.spacing.md, paddingBottom: tokens.spacing.xl }}>
      <Card>
        {base.image ? <Image source={{ uri: base.image }} style={styles.cover} /> : null}

        <ThemedText variant="display">{base.title}</ThemedText>

        {(base as any)?.subtitle ? (
          <ThemedText variant="subtitle" color={tokens.colors.textDim}>
            {(base as any).subtitle}
          </ThemedText>
        ) : null}

        {(base as any)?.description ? (
          <ThemedText variant="body" style={{ marginTop: 6 }}>
            {(base as any).description}
          </ThemedText>
        ) : null}

        <View style={styles.meta}>
          <ThemedText variant="caption" color={tokens.colors.textDim}>
            Tier {(base as any)?.tier ?? 1} • {(base as any)?.estDurationMin ?? 30} min
            {(base as any)?.pointsRequired ? ` • ${(base as any).pointsRequired}+ pts` : ''}
            {(base as any)?.isPremium ? ' • Premium' : ''}
          </ThemedText>
        </View>

        <View style={{ height: tokens.spacing.md }} />

        <ThemedText variant="title">Steps</ThemedText>
        {(((base as any)?.steps as string[]) ?? ['Make it your own 💞']).map((s: string, i: number) => (
          <View key={i} style={styles.stepRow}>
            <ThemedText variant="display">•</ThemedText>
            <ThemedText variant="body" style={{ flex: 1 }}>
              {s}
            </ThemedText>
          </View>
        ))}

        <View style={{ height: tokens.spacing.lg }} />

        {locked ? (
          <View style={styles.lockedBox}>
            <ThemedText variant="body" color="#fff" center>
              Unlock by earning {(base as any)?.pointsRequired}
              {(base as any)?.isPremium ? ' (or go Premium)' : ''} points.
            </ThemedText>
          </View>
        ) : status === 'in_progress' ? (
          <Button label={submitting ? 'Saving…' : 'Mark completed'} onPress={onComplete} disabled={submitting} />
        ) : status === 'completed' ? (
          <View style={styles.donePill}>
            <ThemedText variant="label" color="#065F46">
              Completed ✓
            </ThemedText>
          </View>
        ) : (
          <Button label="Start challenge" onPress={onStart} />
        )}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  cover: { width: '100%', height: 180, borderRadius: 12, marginBottom: 12 },
  meta: { marginTop: tokens.spacing.s },
  stepRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginTop: 8 },
  lockedBox: {
    backgroundColor: '#111827',
    padding: tokens.spacing.md,
    borderRadius: tokens.radius.md,
    marginTop: tokens.spacing.s,
  },
  donePill: {
    alignSelf: 'flex-start',
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
});