// screens/ChallengesScreen.tsx
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';
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
  all: { bg: '#F3F4F6', fg: tokens.colors.textDim },
  date: { bg: '#FFE5EE', fg: '#8B264C' },
  kindness: { bg: '#E8F7EE', fg: '#1E6E46' },
  conversation: { bg: '#EDE7FF', fg: '#4F46E5' },
  surprise: { bg: '#FFF4E5', fg: '#9A3412' },
  play: { bg: '#E7F0FF', fg: '#1D4ED8' },
};

const DIFF_LABEL: Record<DiffKey, string> = {
  easy: 'Tender Moments',
  medium: 'Heart to Heart',
  hard: 'Passionate Quests',
  pro: 'Forever & Always',
};

// tiny colored dots for the legend
const DIFF_DOT: Record<DiffKey, string> = {
  easy:  '#F8B4C6',
  medium:'#C7B9FF',
  hard:  '#FFB4A6',
  pro:   '#F9D773',
};

export default function ChallengesScreen() {
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { user } = useAuthListener();
  const plan = usePlan(user?.uid);
  const { total, weekly } = usePointsTotal(user?.uid);

  const [tab, setTab] = useState<TabKey>('all');

  /**
   * Selection comes from your seed helper. Make sure CHALLENGE_POOL now
   * includes the 50 “easy / Tender Moments” items we finalized.
   */
  const selection = useMemo(
    () =>
      getWeeklyChallengeSet({
        plan,
        weeklyPoints: weekly,
        uid: user?.uid ?? 'guest',
        pool: CHALLENGE_POOL,
      }),
    [plan, weekly, user?.uid]
  );

  const listToShow = useMemo(() => {
    const src = selection.visible.concat(selection.locked);
    return src.filter((c) => (tab === 'all' ? true : c.category === tab));
  }, [selection, tab]);

  // Premium opens: 3 Easy + 1 Medium + 1 Hard + 1 Pro = 6 instantly playable.
  const PREMIUM_BASE_OPEN = 6;
  const currentVisibleCount = selection.visible.length;
  const moreWithPremiumNow = Math.max(0, PREMIUM_BASE_OPEN - currentVisibleCount);

  // Prefer a preview from Medium → Hard → Pro among currently locked
  const previewCandidate = useMemo(() => {
    const byPref: DiffKey[] = ['medium', 'hard', 'pro', 'easy'];
    return byPref
      .map(diff => selection.locked.find(c => (c as any).difficulty === diff))
      .find(Boolean) ?? selection.locked[0];
  }, [selection.locked]);

  // Locked iff it isn't in the visible set
  function isLocked(c: SeedChallenge) {
    return !selection.visible.some((v) => v.id === c.id);
  }

  // Count visible by difficulty (for a tiny legend)
  const visibleByDiff = useMemo(() => {
    const m: Record<DiffKey, number> = { easy: 0, medium: 0, hard: 0, pro: 0 };
    for (const c of selection.visible) {
      const d = (c as any).difficulty as DiffKey | undefined;
      if (d && m[d] !== undefined) m[d] += 1;
    }
    return m;
  }, [selection.visible]);

  const Header = (
    <View style={styles.header}>
      <ThemedText variant="display">Challenges</ThemedText>
      <ThemedText variant="subtitle" color={tokens.colors.textDim}>
        Total points: {total}
      </ThemedText>

      {/* Category chips */}
      <View style={styles.chips}>
        {TABS.map((t) => {
          const active = t.key === tab;
          return (
            <Pressable
              key={t.key}
              onPress={() => setTab(t.key)}
              style={[styles.chip, active && styles.chipActive]}
              accessibilityRole="button"
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

      {/* Tiny difficulty legend (non-interactive) */}
      <View style={styles.legendRow} accessibilityRole="text">
        {(['easy','medium','hard','pro'] as DiffKey[]).map((d) => (
          <View key={d} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: DIFF_DOT[d] }]} />
            <ThemedText variant="caption" color={tokens.colors.textDim}>
              {DIFF_LABEL[d]} {visibleByDiff[d] ? `· ${visibleByDiff[d]}` : ''}
            </ThemedText>
          </View>
        ))}
      </View>

      {/* Plan banner */}
      {plan === 'free' ? (
        <View style={styles.lockBanner}>
          <Ionicons name="lock-closed" size={16} color={tokens.colors.primaryDark} />
          <ThemedText variant="label" color={tokens.colors.primaryDark} style={{ marginLeft: 8 }}>
            Free this week: 1 Easy is open. Earn points to unlock a bonus Hard.
          </ThemedText>
        </View>
      ) : (
        <View style={styles.tipBanner}>
          <Ionicons name="trophy" size={16} color={tokens.colors.primaryDark} />
          <ThemedText variant="label" color={tokens.colors.primaryDark} style={{ marginLeft: 8 }}>
            Open now: 3 Easy + 1 Medium + 1 Hard + 1 Pro. Earn points to unlock even more.
          </ThemedText>
        </View>
      )}
    </View>
  );

  function openPaywall() {
    try {
      nav.navigate('Paywall');
    } catch {
      Alert.alert('Premium', 'Coming soon ✨');
    }
  }

  // --- Upsell under the list ---
  function PremiumTeaser({
    lockedCount,
    previewTitle,
  }: {
    lockedCount: number;
    previewTitle?: string;
  }) {
    const deltaEasy = 2; // free has 1 easy; premium opens 3

    return (
      <Card style={[styles.card, styles.premiumTeaser]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={styles.diamondSmall}>
            <Ionicons name="diamond" size={14} color="#fff" />
          </View>
          <ThemedText variant="title">Premium — for both of you</ThemedText>
        </View>

        <View style={styles.checkList}>
          <Check text={`Start tonight: +${deltaEasy} more Easy unlocked`} />
          <Check text="Also open 1 Medium, 1 Hard, 1 Pro immediately" />
          <Check text="Unlock the rest with your weekly points" />
        </View>

        <View style={styles.partnerChip}>
          <Ionicons name="people-outline" size={14} color={tokens.colors.primaryDark} />
          <ThemedText variant="label" color={tokens.colors.primaryDark} style={{ marginLeft: 6 }}>
            One purchase covers both partners
          </ThemedText>
        </View>

        <ThemedText variant="caption" color={tokens.colors.textDim} style={{ marginTop: 8 }}>
          You’d get <ThemedText variant="caption">+{lockedCount}</ThemedText> more playable challenges right now.
        </ThemedText>

        {previewTitle ? (
          <View style={styles.previewRow}>
            <Ionicons name="lock-closed" size={14} color="#6B7280" />
            <ThemedText variant="caption" color="#6B7280" style={{ marginLeft: 6 }}>
              Preview: {previewTitle}
            </ThemedText>
          </View>
        ) : null}

        <Button label="Try Premium" onPress={openPaywall} style={{ marginTop: tokens.spacing.md }} />
      </Card>
    );
  }

  function Check({ text }: { text: string }) {
    return (
      <View style={styles.checkRow}>
        <Ionicons name="checkmark-circle" size={16} color={tokens.colors.primaryDark} />
        <ThemedText variant="body" style={{ marginLeft: 8 }}>
          {text}
        </ThemedText>
      </View>
    );
  }

  // Optional long-form card (rare)
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

        <View style={styles.bullets}>
          <Bullet label="Tender Moments — sweet & simple" dot={DIFF_DOT.easy} />
          <Bullet label="Heart to Heart — bonding conversations" dot={DIFF_DOT.medium} />
          <Bullet label="Passionate Quests — playful & adventurous" dot={DIFF_DOT.hard} />
          <Bullet label="Forever & Always — milestone moments" dot={DIFF_DOT.pro} />
          <View style={styles.partnerChip}>
            <Ionicons name="people-outline" size={14} color={tokens.colors.primaryDark} />
            <ThemedText variant="label" color={tokens.colors.primaryDark} style={{ marginLeft: 6 }}>
              Premium includes both partners automatically
            </ThemedText>
          </View>
        </View>

        <Button label="See Premium options" onPress={openPaywall} style={{ marginTop: tokens.spacing.md }} />
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

  // Helper for lock messaging
  function lockMessage(item: SeedChallenge): string {
    // If the item is marked premiumOnly in your pool (optional flag)
    // show Premium requirement. Otherwise show tier threshold.
    // Fallback to premium hint for >easy base items when free plan.
    const tier = (item as any).tier as 'base' | '10' | '25' | '50' | undefined;
    const diff = (item as any).difficulty as DiffKey | undefined;

    if (plan === 'free' && tier === 'base' && diff && diff !== 'easy') {
      return 'Premium required';
    }
    if (tier === '10') return 'Needs 10+ pts';
    if (tier === '25') return 'Needs 25+ pts';
    if (tier === '50') return 'Needs 50+ pts';
    return 'Locked';
  }

  return (
    <View
      style={[
        styles.screen,
        {
          paddingTop: insets.top + tokens.spacing.md,
          paddingBottom: insets.bottom + 12,
          paddingHorizontal: tokens.spacing.lg,
        },
      ]}
    >
      <FlatList
        ListHeaderComponent={Header}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: tokens.spacing.xl }}
        data={listToShow}
        keyExtractor={(i) => i.id}
        ItemSeparatorComponent={() => <View style={{ height: tokens.spacing.s }} />}
        renderItem={({ item }) => {
          const locked = isLocked(item);
          const cat = CAT_COLORS[item.category as TabKey] ?? CAT_COLORS.all;
          const diffLabel = DIFF_LABEL[((item as any).difficulty as DiffKey) ?? 'easy'];

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
                    </ThemedText>
                  </View>
                </View>
              </View>

              {locked ? (
                <Pressable
                  onPress={() => {
                    const msg = lockMessage(item);
                    if (msg.includes('Premium')) openPaywall();
                  }}
                  style={styles.lockBtn}
                  accessibilityRole="button"
                >
                  <Ionicons name="lock-closed" size={16} color="#6B7280" />
                  <ThemedText variant="label" color="#6B7280" style={{ marginLeft: 8 }}>
                    {lockMessage(item)}
                  </ThemedText>
                </Pressable>
              ) : (
                <Button label="Start challenge" onPress={() => {}} style={{ marginTop: tokens.spacing.md }} />
              )}
            </Card>
          );
        }}
        ListEmptyComponent={<PremiumCard />}
        ListFooterComponent={
          plan === 'free' ? (
            <PremiumTeaser
              lockedCount={moreWithPremiumNow}
              previewTitle={previewCandidate?.title}
            />
          ) : null
        }
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

  // tiny difficulty legend
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: tokens.spacing.s,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center' },
  legendDot: { width: 8, height: 8, borderRadius: 999, marginRight: 6 },

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
  tipBanner: {
    marginTop: tokens.spacing.md,
    alignSelf: 'stretch',
    backgroundColor: '#EEF2FF',
    borderColor: '#E0E7FF',
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
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: tokens.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
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

  // Upsell under the list
  premiumTeaser: {
    borderWidth: 1,
    borderColor: tokens.colors.cardBorder,
    backgroundColor: '#FFF7FB',
  },
  checkList: { marginTop: tokens.spacing.s, rowGap: 8 },
  checkRow: { flexDirection: 'row', alignItems: 'center' },
  previewRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },

  // Fallback long card (rarely used)
  premiumCard: {
    borderWidth: 1,
    borderColor: tokens.colors.cardBorder,
    backgroundColor: '#FFF5F8',
  },
  premiumHeader: { flexDirection: 'row', alignItems: 'center' },
  diamond: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: tokens.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  diamondSmall: {
    width: 20,
    height: 20,
    borderRadius: 6,
    backgroundColor: tokens.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bullets: { marginTop: tokens.spacing.s, rowGap: 6 },
  bulletRow: { flexDirection: 'row', alignItems: 'center' },
  bulletDot: { width: 8, height: 8, borderRadius: 999, marginRight: 8 },

  partnerChip: {
    marginTop: 8,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: tokens.radius.pill,
    backgroundColor: tokens.colors.primarySoft,
    borderWidth: 1,
    borderColor: tokens.colors.primarySoftBorder,
  },
});