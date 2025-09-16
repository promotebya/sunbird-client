// screens/ChallengesScreen.tsx
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Button from '../components/Button';
import Card from '../components/Card';
import ThemedText from '../components/ThemedText';
import { tokens } from '../components/tokens';

import useAuthListener from '../hooks/useAuthListener';
import usePlan from '../hooks/usePlan';
import usePointsTotal from '../hooks/usePointsTotal';
import {
  CHALLENGE_POOL,
  getWeeklyChallengeSet,
  type SeedChallenge,
} from '../utils/seedchallenges';

type TabKey = 'all' | 'date' | 'kindness' | 'conversation' | 'surprise' | 'play';
type DiffKey = 'easy' | 'medium' | 'hard' | 'pro';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'date', label: 'Dates' },
  { key: 'kindness', label: 'Kindness' },
  { key: 'conversation', label: 'Talk' },
  { key: 'surprise', label: 'Surprise' },
  { key: 'play', label: 'Play' },
];

const CAT_COLORS: Record<TabKey, { bg: string; fg: string }> = {
  all:         { bg: '#F3F4F6', fg: tokens.colors.textDim },
  date:        { bg: '#FFE5EE', fg: '#8B264C' },
  kindness:    { bg: '#E8F7EE', fg: '#1E6E46' },
  conversation:{ bg: '#EDE7FF', fg: '#4F46E5' },
  surprise:    { bg: '#FFF4E5', fg: '#9A3412' },
  play:        { bg: '#E7F0FF', fg: '#1D4ED8' },
};

const DIFF_LABEL: Record<DiffKey, string> = {
  easy:   'Tender Moments',
  medium: 'Heart to Heart',
  hard:   'Passionate Quests',
  pro:    'Forever & Always',
};

export default function ChallengesScreen() {
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { user } = useAuthListener();
  const plan = usePlan(user?.uid);
  const { total, weekly } = usePointsTotal(user?.uid);

  const [tab, setTab] = useState<TabKey>('all');

  const selection = useMemo(() => {
    return getWeeklyChallengeSet({
      plan,
      weeklyPoints: weekly,
      uid: user?.uid ?? 'guest',
      pool: CHALLENGE_POOL,
    });
  }, [plan, weekly, user?.uid]);

  const listToShow = useMemo(() => {
    const src = selection.visible.concat(selection.locked);
    return src.filter((c) => (tab === 'all' ? true : c.category === tab));
  }, [selection, tab]);

  function isLocked(c: SeedChallenge) {
    if (plan === 'free') return false; // free shows only the single unlocked one
    if (c.tier === '10') return weekly < 10;
    if (c.tier === '25') return weekly < 25;
    if (c.tier === '50') return weekly < 50;
    return false;
  }

  const Header = (
    <View style={styles.header}>
      <ThemedText variant="display">Challenges</ThemedText>
      <ThemedText variant="subtitle" color={tokens.colors.textDim}>
        Total points: {total}
      </ThemedText>

      <View style={styles.chips}>
        {TABS.map((t) => {
          const active = t.key === tab;
          return (
            <Pressable
              key={t.key}
              onPress={() => setTab(t.key)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <ThemedText
                variant="label"
                color={active ? tokens.colors.buttonTextPrimary : tokens.colors.textDim}
              >
                {t.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      {plan === 'free' && weekly < 10 ? (
        <View style={styles.lockBanner}>
          <Ionicons name="lock-closed" size={16} color={tokens.colors.primaryDark} />
          <ThemedText variant="label" color={tokens.colors.primaryDark} style={{ marginLeft: 8 }}>
            Earn 10 weekly points to unlock this week’s free challenge
          </ThemedText>
        </View>
      ) : null}
    </View>
  );

  function PremiumCard() {
    return (
      <Card style={[styles.card, styles.premiumCard]}>
        <View style={styles.premiumHeader}>
          <View style={styles.diamond}>
            <Ionicons name="diamond" size={16} color="#fff" />
          </View>
          <ThemedText variant="title" style={{ marginLeft: 8 }}>
            Go Premium
          </ThemedText>
        </View>

        <ThemedText variant="body" color={tokens.colors.textDim} style={{ marginTop: 6 }}>
          Unlock rotating sets each week across every category with romantic tiers:
        </ThemedText>

        <View style={styles.bullets}>
          <Bullet label="Tender Moments — sweet & simple" dot="#F8B4C6" />
          <Bullet label="Heart to Heart — bonding conversations" dot="#C7B9FF" />
          <Bullet label="Passionate Quests — playful & adventurous" dot="#FFB4A6" />
          <Bullet label="Forever & Always — deeper milestone ideas" dot="#F9D773" />
        </View>

        <ThemedText variant="caption" color={tokens.colors.textDim} style={{ marginTop: 6 }}>
          Plus: partner push notes, bonus surprises & early access.
        </ThemedText>

        <Button
          label="See Premium options"
          onPress={() => {
            try {
              nav.navigate('Paywall');
            } catch {
              Alert.alert('Premium', 'Coming soon ✨');
            }
          }}
          style={{ marginTop: tokens.spacing.md }}
        />
      </Card>
    );
  }

  function Bullet({ label, dot }: { label: string; dot: string }) {
    return (
      <View style={styles.bulletRow}>
        <View style={[styles.bulletDot, { backgroundColor: dot }]} />
        <ThemedText variant="body">{label}</ThemedText>
      </View>
    );
  }

  const freeLocked = plan === 'free' && weekly < 10;

  return (
    <View
      style={[
        styles.screen,
        { paddingTop: insets.top + tokens.spacing.md, paddingBottom: insets.bottom + 12, paddingHorizontal: tokens.spacing.lg },
      ]}
    >
      <FlatList
        ListHeaderComponent={Header}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: tokens.spacing.xl }}
        data={freeLocked ? [] : listToShow}
        keyExtractor={(i) => i.id}
        ItemSeparatorComponent={() => <View style={{ height: tokens.spacing.s }} />}
        renderItem={({ item }) => {
          const locked = isLocked(item);
          const cat = CAT_COLORS[item.category as TabKey] ?? CAT_COLORS.all;
          const diffLabel = DIFF_LABEL[(item.difficulty as DiffKey) ?? 'easy'];

          return (
            <Card style={styles.card}>
              <View style={styles.row}>
                <View style={styles.iconBubble}>
                  <Ionicons name="sparkles" size={18} color={tokens.colors.buttonTextPrimary} />
                </View>

                <View style={{ flex: 1 }}>
                  <ThemedText variant="title">{item.title}</ThemedText>

                  <ThemedText variant="body" color={tokens.colors.textDim} style={{ marginTop: 4 }}>
                    {item.description}
                  </ThemedText>

                  <View style={styles.metaRow}>
                    <View style={[styles.metaPill, { backgroundColor: cat.bg }]}>
                      <ThemedText variant="caption" color={cat.fg}>
                        {item.category}
                      </ThemedText>
                    </View>
                    <View style={[styles.metaPill, styles.levelPill]}>
                      <ThemedText variant="caption" color={tokens.colors.primaryDark}>
                        {diffLabel}
                      </ThemedText>
                    </View>
                    <ThemedText variant="caption" color={tokens.colors.textDim}>
                      {` • +${item.points} pts`}
                      {item.tier !== 'base' ? ` • unlocks ${item.tier}+` : ''}
                      {item.premiumOnly ? ' • Premium' : ''}
                    </ThemedText>
                  </View>
                </View>
              </View>

              {plan === 'free' ? (
                <Button
                  label="Start challenge"
                  onPress={() => {}}
                  style={{ marginTop: tokens.spacing.md }}
                />
              ) : locked ? (
                <View style={styles.lockBtn}>
                  <Ionicons name="lock-closed" size={16} color="#6B7280" />
                  <ThemedText variant="label" color="#6B7280" style={{ marginLeft: 8 }}>
                    {item.tier === '10' ? 'Needs 10+ pts' : item.tier === '25' ? 'Needs 25+ pts' : 'Needs 50+ pts'}
                  </ThemedText>
                </View>
              ) : (
                <Button
                  label="Start challenge"
                  onPress={() => {}}
                  style={{ marginTop: tokens.spacing.md }}
                />
              )}
            </Card>
          );
        }}
        ListEmptyComponent={<PremiumCard />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: tokens.colors.bg },
  header: { paddingBottom: tokens.spacing.s },

  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing.s as number,
    marginTop: tokens.spacing.s,
  },
  chip: {
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: 8,
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    borderColor: tokens.colors.cardBorder,
    backgroundColor: tokens.colors.card,
  },
  chipActive: { backgroundColor: tokens.colors.primary, borderColor: tokens.colors.primary },

  lockBanner: {
    marginTop: tokens.spacing.md,
    alignSelf: 'stretch',
    backgroundColor: tokens.colors.primarySoft,
    borderColor: tokens.colors.primarySoftBorder,
    borderWidth: 1,
    borderRadius: tokens.radius.pill,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },

  card: { marginTop: tokens.spacing.md },
  row: { flexDirection: 'row', gap: tokens.spacing.md as number },

  iconBubble: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: tokens.colors.primary, alignItems: 'center', justifyContent: 'center',
    marginRight: 8,
  },

  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, flexWrap: 'wrap' },
  metaPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: tokens.radius.pill, marginRight: 6 },
  levelPill: { backgroundColor: '#FFE1EA', borderWidth: 1, borderColor: '#FFD0DF' },

  lockBtn: {
    marginTop: tokens.spacing.md,
    alignSelf: 'flex-start',
    borderRadius: tokens.radius.pill,
    paddingVertical: 8,
    paddingHorizontal: tokens.spacing.md,
    backgroundColor: tokens.colors.primarySoft,
    borderWidth: 1,
    borderColor: tokens.colors.primarySoftBorder,
    flexDirection: 'row',
    alignItems: 'center',
  },

  // Premium cosmetics
  premiumCard: {
    borderWidth: 1,
    borderColor: tokens.colors.cardBorder,
    backgroundColor: '#FFF5F8',
  },
  premiumHeader: { flexDirection: 'row', alignItems: 'center' },
  diamond: {
    width: 24, height: 24, borderRadius: 6,
    backgroundColor: tokens.colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  bullets: { marginTop: tokens.spacing.s, rowGap: 6 },
  bulletRow: { flexDirection: 'row', alignItems: 'center' },
  bulletDot: { width: 8, height: 8, borderRadius: 999, marginRight: 8 },
});
