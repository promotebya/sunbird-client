// screens/ChallengeDetailScreen.tsx
import { RouteProp, useRoute } from '@react-navigation/native';
import { useMemo } from 'react';
import { DeviceEventEmitter, Image, ScrollView, StyleSheet, View } from 'react-native';
import Button from '../components/Button';
import Card from '../components/Card';
import ThemedText from '../components/ThemedText';
import { tokens } from '../components/tokens';
import useAuthListener from '../hooks/useAuthListener';
import { Challenge, useChallenges } from '../hooks/useChallenges';
import { usePro } from '../utils/subscriptions';

// ⬇️ add: pair-aware points write
import { getPairId } from '../utils/partner';
import { createPointsEntry } from '../utils/points';

type Params = {
  challenge: Challenge;
  status: 'locked' | 'unlocked' | 'in_progress' | 'completed';
  // Optional fields for newer flow (kept backward compatible)
  completionChannel?: string; // e.g. 'lp.challenge.completed'
  seed?: any;                 // if you navigate with a "seed" object instead of "challenge"
};

export default function ChallengeDetailScreen() {
  const route = useRoute<RouteProp<Record<string, Partial<Params>>, string>>();
  const { user } = useAuthListener();
  const { hasPro } = usePro();

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
    await mark(base.id, 'completed');
    if (!user) return;

    // Prefer explicit challenge points; fallback to a tiny tier-based value.
    const challengePts =
      typeof (base as any)?.points === 'number'
        ? Number((base as any).points)
        : Math.max(1, Number((base as any)?.tier ?? 1)) * 2;

    // Optimistic UI bump for HomeScreen (weekly + total bars)
    DeviceEventEmitter.emit(completionChannel, {
      challengeId: base.id,
      points: challengePts,
      title: base.title,
      // prevents accidental double-awards in this session (if you later add any listeners)
      idempotencyKey: `${user.uid}:${base.id}:completed`,
    });

    // Persist the points so both partners see identical totals
    try {
      const pid = await getPairId(user.uid).catch(() => null);
      await createPointsEntry({
        ownerId: user.uid,
        pairId: pid ?? null,         // ← critical for shared totals across the pair
        value: challengePts,
        reason: `Completed challenge: ${base.title}`,
      });
    } catch {
      // ignore write errors; optimistic UI already updated and stream will reconcile later
    }
  }

  const locked = status === 'locked';

  return (
    <ScrollView contentContainerStyle={{ padding: tokens.spacing.md, paddingBottom: tokens.spacing.xl }}>
      <Card>
        {base.image ? <Image source={{ uri: base.image }} style={styles.cover} /> : null}

        <ThemedText variant="display">{base.title}</ThemedText>

        {base.subtitle ? (
          <ThemedText variant="subtitle" color={tokens.colors.textDim}>
            {base.subtitle}
          </ThemedText>
        ) : null}

        {base.description ? (
          <ThemedText variant="body" style={{ marginTop: 6 }}>
            {base.description}
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
        {((base as any)?.steps ?? ['Make it your own 💞']).map((s: string, i: number) => (
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
              Unlock by earning {(base as any)?.pointsRequired} points
              {(base as any)?.isPremium ? ' (or go Premium)' : ''}.
            </ThemedText>
          </View>
        ) : status === 'in_progress' ? (
          <Button label="Mark completed" onPress={onComplete} />
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