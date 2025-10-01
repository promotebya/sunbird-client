import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  SectionList,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Button from '../components/Button';
import Card from '../components/Card';
import ThemedText from '../components/ThemedText';
import { useTokens, type ThemeTokens } from '../components/ThemeProvider';

import useAuthListener from '../hooks/useAuthListener';
import { usePlanPlus } from '../hooks/usePlan';
import usePointsTotal from '../hooks/usePointsTotal';
import {
  CHALLENGE_POOL,
  getWeeklyChallengeSet,
  type SeedChallenge,
} from '../utils/seedchallenges';
import { usePro } from '../utils/subscriptions';

/* ---------- types & labels ---------- */

type DiffTabKey = 'all' | 'easy' | 'medium' | 'hard' | 'pro';
type DiffKey = 'easy' | 'medium' | 'hard' | 'pro';
type CatKey = 'date' | 'kindness' | 'conversation' | 'surprise' | 'play';

const ORDER: DiffKey[] = ['easy', 'medium', 'hard', 'pro'];

const TABS: { key: DiffTabKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'easy', label: 'Tender Moments (easy)' },
  { key: 'medium', label: 'Heart to Heart (medium)' },
  { key: 'hard', label: 'Passionate Quests (hard)' },
  { key: 'pro', label: 'Forever & Always (pro)' },
];

const DIFF_SIMPLE: Record<DiffKey, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
  pro: 'Pro',
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
const CAT_DOT: Record<CatKey, string> = {
  date: '#F59E0B',
  kindness: '#10B981',
  conversation: '#A78BFA',
  surprise: '#F97316',
  play: '#60A5FA',
};

/* ---------- helpers ---------- */

function withAlpha(hex: string, alpha: number) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const a = Math.round(alpha * 255).toString(16).padStart(2, '0');
  return `#${full}${a}`;
}

function normDiff(raw: any): DiffKey | undefined {
  if (raw == null) return undefined;
  const n = Number(raw);
  if (Number.isFinite(n)) return (['easy', 'medium', 'hard', 'pro'][Math.max(0, Math.min(3, n))] as DiffKey);
  const v = String(raw).trim().toLowerCase();
  if (v.startsWith('e')) return 'easy';
  if (v.startsWith('m')) return 'medium';
  if (v.startsWith('h')) return 'hard';
  if (v.startsWith('p')) return 'pro';
  return undefined;
}

function extractDiffStrict(c: any): DiffKey | undefined {
  const tried = [c?.difficulty, c?.level, c?.diff, c?.difficultyLevel, c?.difficulty_label, c?.difficultyLabel, c?.d];
  for (const t of tried) {
    const k = normDiff(t);
    if (k) return k;
  }
  return undefined;
}
const extractTitleStrict = (c: any) =>
  c?.title ?? c?.name ?? c?.heading ?? c?.prompt ?? c?.text ?? undefined;
const extractDescriptionStrict = (c: any) =>
  c?.description ?? c?.summary ?? c?.body ?? c?.details ?? undefined;

function extractCategoryStrict(c: any): CatKey | undefined {
  const candidates: Array<string | string[]> = [
    c?.category, c?.cat, c?.type, c?.topic, c?.tag, c?.tags, c?.labels, c?.categories,
  ];
  const set: Record<string, CatKey> = {
    date: 'date', dates: 'date',
    kindness: 'kindness',
    talk: 'conversation', conversation: 'conversation', convo: 'conversation',
    surprise: 'surprise',
    play: 'play',
  };
  for (const cand of candidates) {
    if (Array.isArray(cand)) {
      for (const s of cand) {
        const key = set[String(s).trim().toLowerCase()];
        if (key) return key;
      }
    } else if (cand != null) {
      const key = set[String(cand).trim().toLowerCase()];
      if (key) return key;
    }
  }
  return undefined;
}

const safeTitle = (c: any) => extractTitleStrict(c) ?? 'Challenge';
const safeDescription = (c: any) => extractDescriptionStrict(c);
const safeCategory = (c: any) => extractCategoryStrict(c);

function rowKey(c: any, suffix: 'V' | 'L', index: number): string {
  const base = c?.id ?? c?.slug ?? `${safeTitle(c)}|${safeCategory(c) ?? 'na'}|${extractDiffStrict(c) ?? 'na'}`;
  return `${String(base)}__${suffix}_${index}`;
}

function mergePreferBase<T extends Record<string, any>>(base: T, patch: Partial<T>): T {
  const out: any = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    if (v == null) continue;
    if (typeof v === 'string' && v.trim() === '') continue;
    if (Array.isArray(v) && v.length === 0) continue;
    out[k] = v;
  }
  return out as T;
}

/** Collapsible long text */
function Clamp({
  text,
  lines = 4,
  dimColor,
}: {
  text: string;
  lines?: number;
  dimColor: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showToggle, setShowToggle] = useState<boolean>(text.length > 140);

  return (
    <View>
      <ThemedText
        variant="body"
        color={dimColor}
        style={{ marginTop: 4 }}
        numberOfLines={expanded ? undefined : lines}
        onTextLayout={(e) => {
          const n = e?.nativeEvent?.lines?.length ?? 0;
          if (n > lines) setShowToggle(true);
        }}
        ellipsizeMode="tail"
      >
        {text}
      </ThemedText>
      {showToggle && (
        <Pressable
          onPress={() => setExpanded((v) => !v)}
          accessibilityRole="button"
          style={{ marginTop: 6 }}
        >
          <ThemedText variant="label" color={dimColor}>
            {expanded ? 'Show less' : 'Read more'}
          </ThemedText>
        </Pressable>
      )}
    </View>
  );
}

function lockMessage(plan: 'free' | 'premium', c: SeedChallenge): string {
  const tier = (c as any)?.tier as 'base' | '10' | '25' | '50' | undefined;
  const d = extractDiffStrict(c);
  if (plan === 'free' && (tier === 'base' || tier === undefined) && d && d !== 'easy') {
    return 'Premium required';
  }
  if (tier === '10') return 'Needs 10+ pts';
  if (tier === '25') return 'Needs 25+ pts';
  if (tier === '50') return 'Needs 50+ pts';
  return 'Locked';
}

/* ---------- screen ---------- */

export default function ChallengesScreen() {
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const t = useTokens();
  const s = useMemo(() => styles(t), [t]);

  const { user } = useAuthListener();
  const { isPremium } = usePlanPlus(user?.uid);
  const { hasPro } = usePro();
  const { total, weekly } = usePointsTotal(user?.uid);

  const effectivePremium = !!(isPremium || hasPro);
  const safePlan: 'free' | 'premium' = effectivePremium ? 'premium' : 'free';
  const weeklySafe = Number.isFinite(weekly as any) ? Number(weekly) : 0;

  const [tab, setTab] = useState<DiffTabKey>('all');

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

  const POOL_BY_ID = useMemo(() => {
    const m = new Map<string, any>();
    for (const p of CHALLENGE_POOL) {
      const id = (p as any)?.id;
      if (id != null) m.set(String(id), p);
    }
    return m;
  }, []);

  const selectionSafe = useMemo(() => {
    const totalCount = selection.visible.length + selection.locked.length;
    if (totalCount > 0) return selection;

    const anyEasy = CHALLENGE_POOL.find((c) => extractDiffStrict(c) === 'easy');
    const anyHard = CHALLENGE_POOL.find((c) => extractDiffStrict(c) === 'hard');
    const vis: SeedChallenge[] = [];
    const lock: SeedChallenge[] = [];
    if (anyEasy) vis.push({ ...(anyEasy as SeedChallenge), tier: 'base' as const });
    if (anyHard) {
      if (safePlan === 'free') lock.push({ ...(anyHard as SeedChallenge), tier: '25' as const });
      else vis.push({ ...(anyHard as SeedChallenge), tier: 'base' as const });
    }
    return { visible: vis, locked: lock };
  }, [selection, safePlan]);

  /* ---------- rows & sections ---------- */

  type Row = { id: string; c: SeedChallenge; locked: boolean };

  const allRows = useMemo<Row[]>(() => {
    const decorate = (c: SeedChallenge) => {
      const id = (c as any)?.id;
      const base = id != null ? POOL_BY_ID.get(String(id)) : undefined;
      if (!base) return c;

      const merged = mergePreferBase(base, c as any);
      (merged as any).difficulty  = extractDiffStrict(c) ?? extractDiffStrict(base);
      (merged as any).title       = extractTitleStrict(c) ?? extractTitleStrict(base);
      (merged as any).description = extractDescriptionStrict(c) ?? extractDescriptionStrict(base);
      (merged as any).category    = extractCategoryStrict(c) ?? extractCategoryStrict(base);
      return merged as SeedChallenge;
    };

    const vis: Row[] = selectionSafe.visible.map((c, i) => {
      const merged = decorate(c);
      return { id: rowKey(merged, 'V', i), c: merged, locked: false };
    });

    const lock: Row[] = selectionSafe.locked.map((c, i) => {
      const merged = decorate(c);
      return { id: rowKey(merged, 'L', i), c: merged, locked: true };
    });

    return [...vis, ...lock];
  }, [selectionSafe.visible, selectionSafe.locked, POOL_BY_ID]);

  const rowsByDiff = useMemo<Record<DiffKey, Row[]>>(() => {
    const acc: Record<DiffKey, Row[]> = { easy: [], medium: [], hard: [], pro: [] };
    for (const r of allRows) {
      const d = extractDiffStrict(r.c) ?? 'easy';
      acc[d].push(r);
    }
    return acc;
  }, [allRows]);

  const sections = useMemo(() => {
    const wanted = tab === 'all' ? ORDER : ([tab] as DiffKey[]);
    return wanted
      .map((d) => ({
        key: `sec_${d}`,
        title: `${DIFF_SIMPLE[d]} — ${DIFF_LABEL[d]}`,
        data: rowsByDiff[d],
      }))
      .filter((sec) => sec.data.length > 0);
  }, [rowsByDiff, tab]);

  const visibleByCat = useMemo(() => {
    const m: Record<CatKey, number> = { date: 0, kindness: 0, conversation: 0, surprise: 0, play: 0 };
    for (const r of allRows) {
      if (!r.locked) {
        const k = safeCategory(r.c);
        if (k) m[k] += 1;
      }
    }
    return m;
  }, [allRows]);

  /* ---------- navigation helpers ---------- */

  const navRef = useNavigation<any>();
  const openChallenge = useCallback(
    (seed: SeedChallenge) => {
      const params = { challengeId: seed.id, seed };
      const targets = ['ChallengeDetail', 'ChallengeDetailScreen', 'Challenge', 'ChallengeDetails'];
      const navigators = [navRef, navRef.getParent?.()].filter(Boolean) as any[];

      const canNavigateTo = (n: any, name: string) => {
        try {
          const state = n.getState?.();
          const names = new Set<string>();
          const walk = (s: any) => {
            if (!s) return;
            if (Array.isArray(s.routes)) {
              for (const r of s.routes) {
                if (r?.name) names.add(r.name);
                if (r?.state) walk(r.state);
              }
            }
          };
          walk(state);
          return names.has(name);
        } catch {
          return false;
        }
      };

      for (const n of navigators) {
        for (const route of targets) {
          if (canNavigateTo(n, route)) {
            try {
              n.navigate(route as never, params as never);
              return;
            } catch {}
          }
        }
      }

      try {
        (navRef.getParent?.() ?? navRef).navigate('ChallengeDetail', params as never);
      } catch (e) {
        console.warn('ChallengeDetail route not found.', e);
        Alert.alert('Challenge', 'Opening the challenge requires a "ChallengeDetail" screen in your navigator.');
      }
    },
    [navRef]
  );

  /* ---------- header ---------- */

  const Header = (
    <View style={s.header}>
      <ThemedText variant="display">Challenges</ThemedText>
      <ThemedText variant="subtitle" color="textDim">
        Total points: {total}
      </ThemedText>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
        {TABS.map((tabDef) => {
          const active = tabDef.key === tab;
          return (
            <Pressable
              key={tabDef.key}
              onPress={() => setTab(tabDef.key)}
              style={[s.chip, active && { backgroundColor: t.colors.primary, borderColor: t.colors.primary }]}
              accessibilityRole="button"
            >
              <ThemedText variant="caption" color={active ? '#fff' : t.colors.textDim}>
                {tabDef.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={s.legendRow} accessibilityRole="text">
        {(['date','kindness','conversation','surprise','play'] as CatKey[]).map((k) => (
          <View key={k} style={s.legendItem}>
            <View style={[s.legendDot, { backgroundColor: CAT_DOT[k] }]} />
            <ThemedText variant="caption" color="textDim">
              {CATEGORY_LABEL[k]} {visibleByCat[k] ? `· ${visibleByCat[k]}` : ''}
            </ThemedText>
          </View>
        ))}
      </View>
    </View>
  );

  /* ---------- footer upsell (only for non-premium) ---------- */

  const UpsellFooter = !effectivePremium ? (
    <Card style={[s.upsellCard, { marginTop: t.spacing.lg, marginBottom: insets.bottom + 8 }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
        <View style={s.upsellBadge}>
          <Ionicons name="sparkles" size={18} color="#fff" />
        </View>
        <ThemedText variant="title" style={{ marginLeft: 10 }}>
          Bring your relationship to the next level
        </ThemedText>
      </View>

      <ThemedText variant="body" color="textDim">
        Go Premium to turn date night into a weekly adventure. Fresh, expert-curated
        challenges you’ll actually look forward to.
      </ThemedText>

      {/* bullets */}
      <View style={{ marginTop: 12 }}>
        {[
          'Unlock 12 curated challenges every week',
          'New every week — always fun, romantic or surprising',
          'Explore 200+ romantic, playful & competitive challenges',
          'One subscription covers both partners',
        ].map((line) => (
          <View key={line} style={s.bulletRow}>
            <Ionicons name="checkmark-circle" size={16} color={t.colors.primary} style={s.bulletIcon} />
            <ThemedText variant="body" style={s.bulletText}>
              {line}
            </ThemedText>
          </View>
        ))}
      </View>

      <ThemedText variant="caption" color="textDim" style={{ marginTop: 12 }}>
        Upgrade now and instantly unlock +5 more challenges today.
      </ThemedText>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
        <Ionicons name="lock-closed" size={14} color="#6B7280" />
        <ThemedText variant="caption" color="textDim" style={{ marginLeft: 6 }}>
          First look: Urban Photo Essay (date)
        </ThemedText>
      </View>

      {/* themed CTA */}
      <Pressable
        onPress={() => {
          try {
            (nav.getParent?.() ?? nav).navigate('Paywall', { plan: 'monthly' });
          } catch {
            Alert.alert('Premium', 'Purchases are coming soon ✨');
          }
        }}
        accessibilityRole="button"
        style={s.tryPremiumBtn}
      >
        <ThemedText variant="button" color="#fff">
          Try Premium
        </ThemedText>
      </Pressable>
    </Card>
  ) : null;

  /* ---------- render ---------- */

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: t.colors.bg,
        paddingTop: insets.top + t.spacing.md,
        paddingBottom: insets.bottom + 12,
        paddingHorizontal: t.spacing.lg,
      }}
    >
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={Header}
        ListFooterComponent={UpsellFooter}
        renderSectionHeader={({ section }) => (
          <View style={s.sectionHeader}>
            <ThemedText variant="h2">{section.title}</ThemedText>
          </View>
        )}
        ItemSeparatorComponent={() => <View style={{ height: t.spacing.s }} />}
        SectionSeparatorComponent={() => <View style={{ height: t.spacing.s }} />}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={{ paddingBottom: t.spacing.xl }}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => {
          const c: any = item.c;
          const dKey = extractDiffStrict(c) ?? 'easy';
          const diffLabel = DIFF_LABEL[dKey];
          const catKey = safeCategory(c);
          const title = safeTitle(c);
          const desc = safeDescription(c);

          const lockedForPlan = safePlan === 'free' && dKey !== 'easy';
          const finalLocked = item.locked || lockedForPlan;

          return (
            <Card style={s.card}>
              <View style={s.row}>
                <View style={s.iconBubble}>
                  <Ionicons name="sparkles" size={18} color={t.colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <ThemedText variant="title">{title}</ThemedText>

                  {!finalLocked ? (
                    <>
                      {!!desc && <Clamp text={desc!} lines={4} dimColor={t.colors.textDim} />}

                      <View style={s.metaRow}>
                        {!!catKey && (
                          <View style={s.metaPill}>
                            <ThemedText variant="caption" color="textDim">
                              {CATEGORY_LABEL[catKey]}
                            </ThemedText>
                          </View>
                        )}
                        <View style={[s.metaPill, s.levelPill]}>
                          <ThemedText variant="caption" color={t.colors.primary}>
                            {diffLabel}
                          </ThemedText>
                        </View>
                        {typeof c?.points === 'number' && (
                          <ThemedText variant="caption" color="textDim">
                            {` • +${c.points} pts`}
                          </ThemedText>
                        )}
                      </View>

                      <Button
                        label="Start challenge"
                        onPress={() => openChallenge(c as SeedChallenge)}
                        style={{ marginTop: t.spacing.md }}
                      />
                    </>
                  ) : (
                    <View style={{ marginTop: t.spacing.s }}>
                      <Pressable
                        onPress={() => {
                          const msg = lockMessage(safePlan, c);
                          if (msg.includes('Premium')) {
                            try {
                              (nav.getParent?.() ?? nav).navigate('Paywall', { plan: 'monthly' });
                            } catch {
                              Alert.alert('Premium', 'Purchases are coming soon ✨');
                            }
                          }
                        }}
                        style={s.lockBtn}
                        accessibilityRole="button"
                      >
                        <Ionicons name="lock-closed" size={16} color={t.colors.textDim} />
                        <ThemedText variant="label" color="textDim" style={{ marginLeft: 8 }}>
                          {lockMessage(safePlan, c)}
                        </ThemedText>
                      </Pressable>
                    </View>
                  )}
                </View>
              </View>
            </Card>
          );
        }}
        ListEmptyComponent={
          <Card style={{ marginTop: t.spacing.md }}>
            <ThemedText variant="title">No challenges here yet</ThemedText>
            <ThemedText variant="caption" color="textDim">
              Try another tab or come back later.
            </ThemedText>
          </Card>
        }
      />

      {effectivePremium ? (
        <View style={[s.premiumBanner, { bottom: insets.bottom + 10 }]}>
          <Ionicons name="sparkles" size={14} color="#fff" />
          <ThemedText variant="label" color="#fff" style={{ marginLeft: 6 }}>
            You’re Premium
          </ThemedText>
        </View>
      ) : null}
    </View>
  );
}

/* ---------- styles ---------- */

const styles = (t: ThemeTokens) =>
  StyleSheet.create({
    header: { paddingBottom: t.spacing.s },

    chips: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: t.spacing.s,
      paddingVertical: 4,
    },
    chip: {
      marginRight: 8,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: t.radius.pill,
      borderWidth: 1,
      borderColor: t.colors.border,
      backgroundColor: t.colors.card,
    },

    legendRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: t.spacing.s },
    legendItem: { flexDirection: 'row', alignItems: 'center', marginRight: 12, marginBottom: 6 },
    legendDot: { width: 8, height: 8, borderRadius: 999, marginRight: 6 },

    sectionHeader: { marginTop: t.spacing.md, marginBottom: t.spacing.xs },

    card: { marginTop: t.spacing.s },
    row: { flexDirection: 'row' },

    iconBubble: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: withAlpha(t.colors.primary, 0.12),
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 8,
    },

    metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, flexWrap: 'wrap' },
    metaPill: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: t.radius.pill,
      marginRight: 6,
      backgroundColor: t.colors.card,
      borderWidth: 1,
      borderColor: t.colors.border,
    },
    levelPill: {
      backgroundColor: withAlpha(t.colors.primary, 0.08),
      borderColor: withAlpha(t.colors.primary, 0.18),
    },

    lockBtn: {
      alignSelf: 'flex-start',
      borderRadius: t.radius.pill,
      paddingVertical: 8,
      paddingHorizontal: t.spacing.md,
      backgroundColor: t.colors.card,
      borderWidth: 1,
      borderColor: t.colors.border,
      flexDirection: 'row',
      alignItems: 'center',
    },

    /* Upsell */
    upsellCard: {
      backgroundColor: withAlpha(t.colors.primary, 0.08),
      borderColor: withAlpha(t.colors.primary, 0.18),
      borderWidth: 1,
    },
    upsellBadge: {
      width: 32,
      height: 32,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.colors.primary,
    },

    // Bullets like Paywall: left-aligned, icon centered to first text line
    bulletRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginTop: 10,
    },
    bulletIcon: { marginTop: 3 },
    bulletText: {
      marginLeft: 8,
      lineHeight: 22,
      textAlign: 'left',
      flex: 1,
    },

    tryPremiumBtn: {
      marginTop: 12,
      alignSelf: 'stretch',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      borderRadius: t.radius.lg,
      backgroundColor: t.colors.primary,
    },

    premiumBanner: {
      position: 'absolute',
      alignSelf: 'center',
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: '#10B981',
      shadowColor: 'rgba(0,0,0,0.15)',
      shadowOpacity: 1,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 3 },
      elevation: 3,
    },
  });