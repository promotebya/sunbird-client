// screens/ChallengesScreen.tsx
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Button from '../components/Button';
import Card from '../components/Card';
import ClampText from '../components/ClampText';
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

type DiffTabKey = 'all' | 'easy' | 'medium' | 'hard' | 'pro';
type DiffKey = 'easy' | 'medium' | 'hard' | 'pro';
type CatKey = 'date' | 'kindness' | 'conversation' | 'surprise' | 'play';

const TABS: { key: DiffTabKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'easy', label: 'Tender Moments (easy)' },
  { key: 'medium', label: 'Heart to Heart (medium)' },
  { key: 'hard', label: 'Passionate Quests (hard)' },
  { key: 'pro', label: 'Forever & Always (pro)' },
];

const DEFAULT_CAT_COLORS = { bg: tokens.colors.card, fg: tokens.colors.textDim } as const;
const CAT_COLORS: Record<CatKey, { bg: string; fg: string }> = {
  date: DEFAULT_CAT_COLORS,
  kindness: DEFAULT_CAT_COLORS,
  conversation: DEFAULT_CAT_COLORS,
  surprise: DEFAULT_CAT_COLORS,
  play: DEFAULT_CAT_COLORS,
};

const DIFF_LABEL: Record<DiffKey, string> = {
  easy: 'Tender Moments',
  medium: 'Heart to Heart',
  hard: 'Passionate Quests',
  pro: 'Forever & Always',
};

const CATEGORY_LABEL: Record<CatKey, string> = {
  date: 'Dates',
  kindness: 'Kindness',
  conversation: 'Talk',
  surprise: 'Surprise',
  play: 'Play',
};

const DIFF_DOT: Record<DiffKey, string> = {
  easy: tokens.colors.primarySoft,
  medium: tokens.colors.primarySoft,
  hard: tokens.colors.primarySoft,
  pro: tokens.colors.primarySoft,
};

export default function ChallengesScreen() {
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { user } = useAuthListener();
  const plan = usePlan(user?.uid);
  const { total, weekly } = usePointsTotal(user?.uid);

  // Safe defaults to protect first render / bad pool states
  const safePlan: 'free' | 'premium' = plan === 'premium' ? 'premium' : 'free';
  const weeklySafe: number = Number.isFinite(weekly as any) ? Number(weekly) : 0;

  const [tab, setTab] = useState<DiffTabKey>('all');

  // Selection from seeded helper (guarantees 1 Easy visible for free plan)
  const selection = useMemo(
    () =>
      getWeeklyChallengeSet({
        plan: safePlan,
        weeklyPoints: weeklySafe,
        uid: user?.uid ?? 'guest',
        pool: CHALLENGE_POOL,
      }),
    [safePlan, weeklySafe, user?.uid]
  );

  // Fallback: ensure at least one card shows even if pool/selector glitch
  const selectionSafe = useMemo(() => {
    const total = selection.visible.length + selection.locked.length;
    if (total > 0) return selection;

    const anyEasy = CHALLENGE_POOL.find((c) => (c as any).difficulty === 'easy');
    const anyHard = CHALLENGE_POOL.find((c) => (c as any).difficulty === 'hard');
    const vis: SeedChallenge[] = [];
    const lock: SeedChallenge[] = [];
    if (anyEasy) vis.push({ ...(anyEasy as SeedChallenge), tier: 'base' as const });
    if (anyHard) {
      if (safePlan === 'free') lock.push({ ...(anyHard as SeedChallenge), tier: '25' as const });
      else vis.push({ ...(anyHard as SeedChallenge), tier: 'base' as const });
    }
    return { visible: vis, locked: lock };
  }, [selection, safePlan]);

  // Dev visibility diagnostics
  if (__DEV__) {
    const poolLen = CHALLENGE_POOL.length;
    const easyCount = CHALLENGE_POOL.filter((c) => (c as any).difficulty === 'easy').length;
    const hardCount = CHALLENGE_POOL.filter((c) => (c as any).difficulty === 'hard').length;
    // eslint-disable-next-line no-console
    console.log('[ChallengesScreen] plan=%s weekly=%s pool=%d easy=%d hard=%d visible=%d locked=%d',
      safePlan, weeklySafe, poolLen, easyCount, hardCount,
      selectionSafe.visible.length, selectionSafe.locked.length);
  }

  const listToShow = useMemo(() => {
    const src = selectionSafe.visible.concat(selectionSafe.locked);
    return src.filter((c) => (tab === 'all' ? true : (c as any).difficulty === tab));
  }, [selectionSafe, tab]);

  const PREMIUM_BASE_OPEN = 6; // 3E + 1M + 1H + 1P
  const currentVisibleCount = selectionSafe.visible.length;
  const moreWithPremiumNow = Math.max(0, PREMIUM_BASE_OPEN - currentVisibleCount);

  const previewCandidate = useMemo(() => {
    const order: DiffKey[] = ['medium', 'hard', 'pro', 'easy'];
    return order
      .map((d) => selectionSafe.locked.find((c) => (c as any).difficulty === d))
      .find(Boolean) ?? selectionSafe.locked[0];
  }, [selectionSafe.locked]);

  const visibleByDiff = useMemo(() => {
    const m: Record<DiffKey, number> = { easy: 0, medium: 0, hard: 0, pro: 0 };
    for (const c of selectionSafe.visible) {
      const d = (c as any).difficulty as DiffKey | undefined;
      if (d && m[d] !== undefined) m[d] += 1;
    }
    return m;
  }, [selectionSafe.visible]);

  const visibleByCat = useMemo(() => {
    const m: Record<CatKey, number> = {
      date: 0,
      kindness: 0,
      conversation: 0,
      surprise: 0,
      play: 0,
    };
    for (const c of selectionSafe.visible) {
      const k = (c as any).category as CatKey | undefined;
      if (k && m[k] !== undefined) m[k] += 1;
    }
    return m;
  }, [selectionSafe.visible]);

  function isLocked(c: SeedChallenge) {
    return !selectionSafe.visible.some((v) => v.id === c.id);
  }

  function openPaywall() {
    try {
      nav.navigate('Paywall');
    } catch {
      Alert.alert('Premium', 'Coming soon ✨');
    }
  }

  const Header = (
    <View style={styles.header}>
      <ThemedText variant="display">Challenges</ThemedText>
      <ThemedText variant="subtitle" color={tokens.colors.textDim}>
        Total points: {total}
      </ThemedText>

      {/* Difficulty tabs (compact, horizontal scroll) */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
      >
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
                variant="caption"
                color={active ? tokens.colors.buttonTextPrimary : tokens.colors.textDim}
              >
                {t.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Tiny category legend */}
      <View style={styles.legendRow} accessibilityRole="text">
        {(['date','kindness','conversation','surprise','play'] as CatKey[]).map((k) => (
          <View key={k} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: tokens.colors.cardBorder }]} />
            <ThemedText variant="caption" color={tokens.colors.textDim}>
              {CATEGORY_LABEL[k]} {visibleByCat[k] ? `· ${visibleByCat[k]}` : ''}
            </ThemedText>
          </View>
        ))}
      </View>

      {/* Plan banner */}
      {safePlan === 'free' ? null : (
        <View style={styles.tipBanner}>
          <Ionicons name="trophy" size={16} color={tokens.colors.primaryDark} />
          <ThemedText variant="label" color={tokens.colors.primaryDark} style={{ marginLeft: 8 }}>
            Open now: 3 Easy + 1 Medium + 1 Hard + 1 Pro. Earn points to unlock even more.
          </ThemedText>
        </View>
      )}
    </View>
  );

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
          const cat = CAT_COLORS[item.category as CatKey] ?? DEFAULT_CAT_COLORS;
          const diffLabel = DIFF_LABEL[((item as any).difficulty as DiffKey) ?? 'easy'];

          return (
            <Card style={styles.card}>
              <View style={styles.row}>
                <View style={styles.iconBubble}>
                  <Ionicons name="sparkles" size={18} color={tokens.colors.buttonTextPrimary} />
                </View>

                <View style={{ flex: 1 }}>
                  <ThemedText variant="title">{item.title}</ThemedText>
                  {!locked && (
                    <>
                      <ClampText initialLines={4}>{item.description}</ClampText>

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
                    </>
                  )}
                </View>
              </View>

              {locked ? (
                <Pressable
                  onPress={() => {
                    const msg = lockMessage(safePlan, item);
                    if (msg.includes('Premium')) openPaywall();
                  }}
                  style={styles.lockBtn}
                  accessibilityRole="button"
                >
                  <Ionicons name="lock-closed" size={16} color={tokens.colors.textDim} />
                  <ThemedText variant="label" color={tokens.colors.textDim} style={{ marginLeft: 8 }}>
                    {lockMessage(safePlan, item)}
                  </ThemedText>
                </Pressable>
              ) : (
                <Button
                  label="Start challenge"
                  onPress={() => {
                    // TODO: nav.navigate('ChallengeDetail', { id: item.id })
                  }}
                  style={{ marginTop: tokens.spacing.md }}
                />
              )}
            </Card>
          );
        }}
        ListFooterComponent={
          safePlan === 'free' ? (
            <PremiumUpsell
              lockedCount={moreWithPremiumNow}
              previewTitle={previewCandidate?.title}
              onPress={openPaywall}
            />
          ) : null
        }
      />
    </View>
  );
}

/* ---------- helpers & subcomponents ---------- */

function lockMessage(
  plan: 'free' | 'premium',
  item: SeedChallenge
): string {
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

function PremiumUpsell({
  lockedCount,
  previewTitle,
  onPress,
}: {
  lockedCount: number;
  previewTitle?: string;
  onPress: () => void;
}) {
  const deltaEasy = 2; // free has 1 easy; premium opens 3

  return (
    <Card style={[styles.card, styles.premiumTeaser]}>
      {/* Put a11y props on a View, not Card, to avoid TS errors */}
      <View accessible accessibilityLabel="Premium upgrade">
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={styles.diamondSmall}>
            <Ionicons name="diamond" size={14} color={tokens.colors.buttonTextPrimary} />
          </View>
          <ThemedText variant="title" style={{ marginLeft: 12 }}>
            Bring your relationship to the next level
          </ThemedText>
        </View>

        <ThemedText variant="body" style={{ marginTop: 6 }}>
          Go Premium to turn date night into a weekly adventure. Fresh, expert‑curated challenges you’ll actually look forward to.
        </ThemedText>

        <View style={styles.checkList}>
          <Check text="Unlock 12 curated challenges every week" />
          <Check text="New every week — always fun, romantic or surprising" />
          <Check text="Explore 200+ romantic, playful & competitive challenges" />
          <Check text="One subscription covers both partners" />
        </View>

        <ThemedText variant="caption" color={tokens.colors.textDim} style={{ marginTop: 8 }}>
          Upgrade now and instantly unlock <ThemedText variant="caption">+{lockedCount}</ThemedText> more challenges today.
        </ThemedText>

        {previewTitle ? (
          <View style={styles.previewRow}>
            <Ionicons name="lock-closed" size={14} color={tokens.colors.textDim} />
            <ThemedText variant="caption" color={tokens.colors.textDim} style={{ marginLeft: 6 }}>
              First look: {previewTitle}
            </ThemedText>
          </View>
        ) : null}

        <Button label="Try Premium" onPress={onPress} style={{ marginTop: tokens.spacing.md }} />
      </View>
    </Card>
  );
}

function Check({ text }: { text: string }) {
  return (
    <View style={styles.checkRow}>
      <View style={styles.checkIcon}>
        <Ionicons name="checkmark-circle" size={16} color={tokens.colors.primaryDark} />
      </View>
      <ThemedText variant="body" style={{ marginLeft: 8, flex: 1 }}>
        {text}
      </ThemedText>
    </View>
  );
}

/* ---------- styles ---------- */

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: tokens.colors.bg },
  header: { paddingBottom: tokens.spacing.s },

  chips: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: tokens.spacing.s,
    paddingVertical: 4,
  },
  chip: {
    marginRight: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    borderColor: tokens.colors.cardBorder,
    backgroundColor: tokens.colors.card,
  },
  chipActive: { backgroundColor: tokens.colors.primary, borderColor: tokens.colors.primary },

  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: tokens.spacing.s,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', marginRight: 12, marginBottom: 6 },
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
  row: { flexDirection: 'row' },

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
  levelPill: { backgroundColor: tokens.colors.primarySoft, borderWidth: 1, borderColor: tokens.colors.primarySoftBorder },

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

  // Upsell
  premiumTeaser: {
    borderWidth: 1,
    borderColor: tokens.colors.cardBorder,
    backgroundColor: tokens.colors.card,
  },
  checkList: { marginTop: tokens.spacing.s },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 6 },
  checkIcon: { marginTop: 2 },
  previewRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },

  diamondSmall: {
    width: 20,
    height: 20,
    borderRadius: 6,
    backgroundColor: tokens.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});