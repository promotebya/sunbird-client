// screens/ChallengeDetailScreen.tsx
import { RouteProp, useRoute } from '@react-navigation/native';
import { useMemo } from 'react';
import { Alert, DeviceEventEmitter, Image, ScrollView, StyleSheet, View } from 'react-native';
import Button from '../components/Button';
import Card from '../components/Card';
import ThemedText from '../components/ThemedText';
import { tokens } from '../components/tokens';
import useAuthListener from '../hooks/useAuthListener';
import { Challenge, useChallenges } from '../hooks/useChallenges';
import { usePro } from '../utils/subscriptions';

// Firestore
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { getPairId } from '../utils/partner';

type Params = {
  challenge: Challenge;
  status: 'locked' | 'unlocked' | 'in_progress' | 'completed';
  completionChannel?: string; // e.g. 'lp.challenge.completed'
  seed?: any;                 // if you navigate with a "seed" object instead of "challenge"
};

// ISO week key in UTC — used for idempotent doc ids per week
function isoWeekKey(d = new Date()) {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = (date.getUTCDay() + 6) % 7; // Mon=0
  date.setUTCDate(date.getUTCDate() - day + 3); // Thu of this week
  const year = date.getUTCFullYear();
  const firstThu = new Date(Date.UTC(year, 0, 4));
  const firstDay = (firstThu.getUTCDay() + 6) % 7;
  firstThu.setUTCDate(firstThu.getUTCDate() - firstDay + 3);
  const week = 1 + Math.round((date.getTime() - firstThu.getTime()) / (7 * 24 * 3600 * 1000));
  return `${year}-W${String(week).padStart(2, '0')}`;
}

// Session guard to avoid rapid double writes
const SESSION_KEYS = new Set<string>();

export default function ChallengeDetailScreen() {
  const route = useRoute<RouteProp<Record<string, Partial<Params>>, string>>();
  const { user } = useAuthListener();
  const { hasPro } = usePro();

  // Accept both legacy `challenge` and optional `seed`
  const base: Partial<Challenge> | undefined =
    (route.params?.challenge as Challenge) ?? (route.params?.seed as Challenge) ?? undefined;

  const startingStatus =
    (route.params?.status as Params['status']) ?? 'unlocked';

  const { myStatuses, mark } = useChallenges(user?.uid, 0, hasPro);
  const status = useMemo(() => {
    if (!base?.id) return startingStatus;
    return myStatuses.find((s) => s.id === base.id)?.status ?? startingStatus;
  }, [myStatuses, base?.id, startingStatus]);

  const completionChannel =
    (route.params?.completionChannel as string) || 'lp.challenge.completed';

  async function awardPoints(pts: number) {
    if (!user?.uid || !base?.id || !Number.isFinite(pts) || pts <= 0) return;

    const weekKey = isoWeekKey();
    const idempotentDocId = `${user.uid}:${String(base.id)}:${weekKey}`;

    if (SESSION_KEYS.has(idempotentDocId)) return;
    SESSION_KEYS.add(idempotentDocId);

    const pairId = await getPairId(user.uid).catch(() => null);

    await setDoc(
      doc(db, 'points', idempotentDocId),
      {
        ownerId: user.uid,
        pairId: pairId ?? null,
        value: pts,
        reason: `Challenge: ${base.title ?? 'Challenge'}`,
        createdAt: serverTimestamp(),
        source: 'challenge',
        challengeId: base.id ?? null,
        week: weekKey,
      },
      { merge: false }
    );
  }

  async function onStart() {
    if (!base?.id) return;
    try {
      await mark(base.id, 'in_progress');
    } catch (e: any) {
      Alert.alert('Could not start', e?.message ?? 'Try again.');
    }
  }

  async function onComplete() {
    if (!base?.id) return;
    try {
      await mark(base.id, 'completed');

      const pts =
        typeof (base as any)?.points === 'number'
          ? Number((base as any).points)
          : Math.max(1, Number((base as any)?.tier ?? 1)) * 2;

      await awardPoints(pts);

      const key = `${user?.uid ?? 'nouser'}:${String(base.id)}:${isoWeekKey()}`;
      DeviceEventEmitter.emit(completionChannel, {
        challengeId: base.id,
        points: pts,
        title: base.title,
        idempotencyKey: key,
      });
    } catch (e: any) {
      Alert.alert('Could not complete', e?.message ?? 'Please try again.');
    }
  }

  // --------- Defensive render: if params are missing, show a safe card, not a crash ----------
  if (!base?.id) {
    return (
      <ScrollView contentContainerStyle={{ padding: tokens.spacing.md, paddingBottom: tokens.spacing.xl }}>
        <Card>
          <ThemedText variant="display">Challenge</ThemedText>
          <ThemedText variant="body" style={{ marginTop: 8 }}>
            This challenge couldn’t be loaded.
          </ThemedText>
          <View style={{ height: tokens.spacing.md }} />
          <Button label="Back to Challenges" onPress={() => (DeviceEventEmitter.emit('nav.back'), null)} />
        </Card>
      </ScrollView>
    );
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
              Unlock by earning {(base as any)?.pointsRequired ?? 'enough'} points
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