// screens/ChallengeDetailScreen.tsx
import { RouteProp, useRoute } from '@react-navigation/native';
import { useMemo } from 'react';
import { Image, ScrollView, StyleSheet, View } from 'react-native';
import Button from '../components/Button';
import Card from '../components/Card';
import ThemedText from '../components/ThemedText';
import { tokens } from '../components/tokens';
import useAuthListener from '../hooks/useAuthListener';
import { Challenge, useChallenges } from '../hooks/useChallenges';
import { createPointsEntry } from '../utils/points';
import { usePro } from '../utils/subscriptions';

type Params = { challenge: Challenge; status: 'locked' | 'unlocked' | 'in_progress' | 'completed' };

export default function ChallengeDetailScreen() {
  const route = useRoute<RouteProp<Record<string, Params>, string>>();
  const base = route.params.challenge;
  const startingStatus = route.params.status;
  const { user } = useAuthListener();
  const { hasPro } = usePro();
  const { myStatuses, mark } = useChallenges(user?.uid, 0, hasPro);

  const status = useMemo(
    () => myStatuses.find((s) => s.id === base.id)?.status ?? startingStatus,
    [myStatuses, base.id, startingStatus]
  );

  async function onStart() {
    await mark(base.id, 'in_progress');
  }
  async function onComplete() {
    await mark(base.id, 'completed');
    if (user) {
      const bonus = Math.max(1, base.tier) * 2; // tiny bonus for finishing
      await createPointsEntry({
        ownerId: user.uid,
        pairId: null,
        value: bonus,
        reason: `Completed challenge: ${base.title}`,
      }).catch(() => {});
    }
  }

  const locked = status === 'locked';

  return (
    <ScrollView contentContainerStyle={{ padding: tokens.spacing.md, paddingBottom: tokens.spacing.xl }}>
      <Card>
        {base.image ? <Image source={{ uri: base.image }} style={styles.cover} /> : null}
        <ThemedText variant="display">{base.title}</ThemedText>
        {base.subtitle ? (
          <ThemedText variant="subtitle" color={tokens.colors.textDim}>{base.subtitle}</ThemedText>
        ) : null}
        {base.description ? (
          <ThemedText variant="body" style={{ marginTop: 6 }}>{base.description}</ThemedText>
        ) : null}

        <View style={styles.meta}>
          <ThemedText variant="caption" color={tokens.colors.textDim}>
            Tier {base.tier} • {base.estDurationMin ?? 30} min
            {base.pointsRequired ? ` • ${base.pointsRequired}+ pts` : ''}
            {base.isPremium ? ' • Premium' : ''}
          </ThemedText>
        </View>

        <View style={{ height: tokens.spacing.md }} />

        <ThemedText variant="title">Steps</ThemedText>
        {(base.steps ?? ['Make it your own 💞']).map((s, i) => (
          <View key={i} style={styles.stepRow}>
            <ThemedText variant="display">•</ThemedText>
            <ThemedText variant="body" style={{ flex: 1 }}>{s}</ThemedText>
          </View>
        ))}

        <View style={{ height: tokens.spacing.lg }} />

        {locked ? (
          <View style={styles.lockedBox}>
            <ThemedText variant="body" color="#fff" center>
              Unlock by earning {base.pointsRequired} points
              {base.isPremium ? ' (or go Premium)' : ''}.
            </ThemedText>
          </View>
        ) : status === 'in_progress' ? (
          <Button label="Mark completed" onPress={onComplete} />
        ) : status === 'completed' ? (
          <View style={styles.donePill}>
            <ThemedText variant="label" color="#065F46">Completed ✓</ThemedText>
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
