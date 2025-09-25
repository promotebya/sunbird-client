// screens/HomeScreen.tsx — Clarity-first: neutral pills, fused rewards CTA, bottom motivation
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import Button from '../components/Button';
import Card from '../components/Card';
import ProgressBar from '../components/ProgressBar';
import RedeemModal from '../components/RedeemModal';
import Screen from '../components/Screen';
import ThemedText from '../components/ThemedText';
import { useTokens, type ThemeTokens } from '../components/ThemeProvider';

import { db } from '../firebaseConfig';
import useAuthListener from '../hooks/useAuthListener';
import usePointsTotal from '../hooks/usePointsTotal';
import useStreak from '../hooks/useStreak';
import { getPairId } from '../utils/partner';
import { addReward, listenRewards, redeemReward, type RewardDoc } from '../utils/rewards';

const WEEK_GOAL = 50;
const MILESTONES = [5, 10, 25, 50, 100, 200, 500];

// Ideas (max 5 shown)
const IDEAS = [
  'Plan a mini date',
  'Sunset photo walk',
  'Bring a snack',
  'Write a love note',
  'Tea + short episode',
  'Make a 5-song playlist',
  '10-minute massage',
  'Cook their favorite',
  'Board game best-of-3',
  'Go for a walk',
];

type PointsItem = {
  id: string;
  value: number;
  reason?: string | null;
  createdAt?: any;
};

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}
function dayKey() {
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}
const offsetFromKey = (k: number) => k % IDEAS.length;
const withAlpha = (hex: string, alpha: number) => {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const a = Math.round(alpha * 255).toString(16).padStart(2, '0');
  return `#${full}${a}`;
};

// Neutral porcelain tones
const HAIRLINE = '#F0E6EF';
const CHIP_BG = '#F3EEF6';

const Pill = ({ children }: { children: React.ReactNode }) => (
  <View
    accessibilityRole="text"
    style={{
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: CHIP_BG,
      borderWidth: 1,
      borderColor: HAIRLINE,
      gap: 8,
    }}
  >
    {children}
  </View>
);

// Compute the next milestone after current total
function nextMilestone(total: number) {
  for (const m of MILESTONES) if (total < m) return { target: m, remaining: m - total };
  const target = MILESTONES[MILESTONES.length - 1] * 2;
  return { target, remaining: Math.max(0, target - total) };
}

export default function HomeScreen() {
  const t = useTokens();
  const s = useMemo(() => styles(t), [t]);
  const nav = useNavigation<any>();
  const { user } = useAuthListener();
  const { total, weekly } = usePointsTotal(user?.uid);
  const streak = useStreak(user?.uid);

  const [pairId, setPairId] = useState<string | null>(null);
  const [rewards, setRewards] = useState<RewardDoc[]>([]);
  const [recent, setRecent] = useState<PointsItem[]>([]);
  const [showAddReward, setShowAddReward] = useState(false);
  const [hideLinkBanner, setHideLinkBanner] = useState(false);

  // Pair info
  useEffect(() => {
    (async () => {
      if (!user) return setPairId(null);
      setPairId(await getPairId(user.uid));
    })();
  }, [user]);

  // Rewards stream
  useEffect(() => {
    if (!user) return;
    const off = listenRewards(user.uid, pairId ?? null, setRewards);
    return () => off && off();
  }, [user, pairId]);

  // Recent (last 3)
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'points'),
      where('ownerId', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(3)
    );
    const off = onSnapshot(q, (snap) => {
      const items: PointsItem[] = snap.docs.map((d) => {
        const data = d.data() as any;
        return {
          id: d.id,
          value: Number(data.value ?? 0),
          reason: data.reason ?? null,
          createdAt: data.createdAt,
        };
      });
      setRecent(items);
    });
    return () => off();
  }, [user]);

  // Daily ideas (rotate at midnight)
  const [key, setKey] = useState<number>(() => dayKey());
  useEffect(() => {
    const now = new Date();
    const next = new Date(now);
    next.setHours(24, 0, 0, 0);
    const to = setTimeout(() => setKey(dayKey()), next.getTime() - now.getTime());
    return () => clearTimeout(to);
  }, [key]);

  const ideas = useMemo(() => {
    const off = offsetFromKey(key);
    const rot = [...IDEAS.slice(off), ...IDEAS.slice(0, off)];
    return rot.slice(0, 5);
  }, [key]);

  const onIdea = useCallback(
    (txt: string) => nav.navigate('Tasks', { presetIdea: txt }),
    [nav]
  );

  const weeklyLeft = Math.max(0, WEEK_GOAL - weekly);
  const nudge =
    weeklyLeft === 0
      ? 'Weekly goal reached—nice! Keep the streak rolling 🔥'
      : weekly < WEEK_GOAL / 3
      ? 'Small steps count—one kind thing today?'
      : weekly < (2 * WEEK_GOAL) / 3
      ? 'You’re halfway there—keep going 👏'
      : 'So close! A tiny push and you’re there ✨';

  const onCreateReward = async (title: string, cost: number) => {
    if (!user) return;
    await addReward(user.uid, pairId ?? null, title, cost);
  };
  const onRedeem = async (r: RewardDoc) => {
    if (!user) return;
    await redeemReward(user.uid, pairId ?? null, r);
  };

  // Milestone computation (for the “Next milestone” row)
  const totalPoints = total ?? 0;
  const { target, remaining } = useMemo(
    () => nextMilestone(totalPoints),
    [totalPoints]
  );

  return (
    <Screen>
      {/* HERO */}
      <View style={{ marginTop: 6, marginBottom: 8 }}>
        <ThemedText variant="display" style={{ marginBottom: 8 }}>
          {greeting()} 👋
        </ThemedText>

        {/* Data pills (left) + Settings (right) */}
        <View style={s.metaRow}>
          <View style={s.pillGroup}>
            <Pill>
              <Ionicons name="flame" size={16} color={t.colors.textDim} />
              <ThemedText variant="label">Streak {streak?.current ?? 0}</ThemedText>
              <ThemedText variant="label" color={t.colors.textDim}>• Best {streak?.longest ?? 0}</ThemedText>
            </Pill>
            <Pill>
              <Ionicons name="trophy" size={16} color={t.colors.textDim} />
              <ThemedText variant="label">{totalPoints}</ThemedText>
            </Pill>
          </View>

          {/* Outline so it doesn’t compete with CTAs */}
          <Button
            label="Settings"
            variant="outline"
            onPress={() => nav.navigate('Settings')}
          />
        </View>
      </View>

      {/* Partner (Action card) */}
      {!pairId && !hideLinkBanner && (
        <Card style={{ marginBottom: 12, paddingVertical: 12, borderWidth: 1, borderColor: HAIRLINE }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View
              style={{
                width: 36, height: 36, borderRadius: 10,
                backgroundColor: withAlpha(t.colors.primary, 0.08),
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Ionicons name="link" size={18} color={t.colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText variant="title">Link with your partner</ThemedText>
              <ThemedText variant="caption" color={t.colors.textDim}>Share points and memories together.</ThemedText>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 10 }}>
            <Button label="Link now" onPress={() => nav.navigate('Pairing')} />
            <Button label="Later" variant="ghost" onPress={() => setHideLinkBanner(true)} />
          </View>
        </Card>
      )}

      {/* Weekly goal (Progress card) — also hosts the Add reward CTA when none exist */}
      <Card style={{ marginBottom: 12, borderWidth: 1, borderColor: HAIRLINE }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
          <ThemedText variant="subtitle" style={{ flex: 1 }}>Weekly goal</ThemedText>
          <ThemedText variant="caption" color={t.colors.textDim}>
            {weekly} / {WEEK_GOAL} · {Math.max(0, WEEK_GOAL - weekly)} to go
          </ThemedText>
        </View>

        <ProgressBar value={weekly} max={WEEK_GOAL} height={8} trackColor="#EDEAF1" />

        <ThemedText variant="caption" color={t.colors.textDim} style={{ marginTop: 8 }}>
          {nudge}
        </ThemedText>

        {/* Next milestone block */}
        <View style={{ marginTop: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <ThemedText variant="label" color={t.colors.textDim}>Next milestone</ThemedText>
            <ThemedText variant="label">{target} pts</ThemedText>
          </View>
          <ProgressBar value={totalPoints} max={target} height={6} trackColor="#EDEAF1" />
          <ThemedText variant="caption" color={t.colors.textDim} style={{ marginTop: 4 }}>
            {remaining} to go • {weekly} this week
          </ThemedText>
        </View>

        <View style={{ marginTop: 12, flexDirection: 'row', gap: 12 }}>
          {/* “Do it now” stays solid; extra action is outline */}
          <Button label="Log a task" onPress={() => nav.navigate('Tasks')} />
          <Button
            label={rewards.length ? 'Add reward' : 'Add first reward'}
            variant="outline"
            onPress={() => setShowAddReward(true)}
          />
        </View>
      </Card>

      {/* Ideas (Navigation block) */}
      <Card style={{ marginBottom: 12, borderWidth: 1, borderColor: HAIRLINE }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
          <ThemedText variant="subtitle" style={{ flex: 1 }}>Ideas for today</ThemedText>
          <Pressable onPress={() => nav.navigate('Discover')} accessibilityRole="link">
            <ThemedText variant="label" color={t.colors.primary}>See more →</ThemedText>
          </Pressable>
          <View style={{ width: 12 }} />
          <Pressable onPress={() => setKey((k) => k + 1)} accessibilityRole="button">
            <ThemedText variant="label" color={t.colors.primary}>🔀 Shuffle</ThemedText>
          </Pressable>
        </View>

        <View style={s.tagWrap}>
          {ideas.map((txt) => (
            <Pressable key={txt} onPress={() => onIdea(txt)} style={s.chip} accessibilityRole="button">
              <Ionicons name="sparkles" size={14} color={t.colors.textDim} />
              <ThemedText variant="label" style={{ marginLeft: 6 }}>{txt}</ThemedText>
            </Pressable>
          ))}
        </View>
      </Card>

      {/* Rewards list (only when you actually have rewards) */}
      {rewards.length > 0 && (
        <Card style={{ marginBottom: 12, borderWidth: 1, borderColor: HAIRLINE }}>
          {rewards.map((item, i) => (
            <View key={item.id} style={[s.rewardRow, i > 0 && s.hairlineTop]}>
              <View style={{ flex: 1 }}>
                <ThemedText variant="title">{item.title}</ThemedText>
                <ThemedText variant="caption" color={t.colors.textDim}>Cost {item.cost} pts</ThemedText>
              </View>
              <Pressable onPress={() => onRedeem(item)} style={s.redeemBtn} accessibilityRole="button">
                <ThemedText variant="button" color="#fff">Redeem</ThemedText>
              </Pressable>
            </View>
          ))}
        </Card>
      )}

      {/* Recent (read-only) */}
      {recent.length > 0 ? (
        <Card style={{ marginBottom: 12, borderWidth: 1, borderColor: HAIRLINE }}>
          <ThemedText variant="subtitle" style={{ marginBottom: 8 }}>Recent activity</ThemedText>
          {recent.map((p, i) => (
            <View key={p.id} style={[s.recentRow, i > 0 && s.hairlineTop]}>
              <ThemedText variant="title" color={t.colors.primary}>
                {p.value > 0 ? `+${p.value}` : p.value}
              </ThemedText>
              <ThemedText variant="caption" color={t.colors.textDim} style={{ marginLeft: 8, flex: 1 }}>
                {p.reason ?? 'Points'}
              </ThemedText>
            </View>
          ))}
        </Card>
      ) : null}

      {/* Motivation to complete a challenge (bottom nudge) */}
      <Card style={{ marginBottom: 16, borderWidth: 1, borderColor: HAIRLINE }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <View
            style={{
              width: 36, height: 36, borderRadius: 10,
              backgroundColor: withAlpha(t.colors.primary, 0.08),
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Ionicons name="sparkles" size={18} color={t.colors.primary} />
          </View>
          <ThemedText variant="title">Try a tiny challenge tonight</ThemedText>
        </View>
        <ThemedText variant="caption" color={t.colors.textDim}>
          A small step keeps your streak healthy. Explore a quick challenge.
        </ThemedText>
        <View style={{ marginTop: 10 }}>
          <Button label="Open Challenges" variant="outline" onPress={() => nav.navigate('Challenges')} />
        </View>
      </Card>

      {/* Add reward modal */}
      <RedeemModal
        visible={showAddReward}
        onClose={() => setShowAddReward(false)}
        onCreate={onCreateReward}
      />
    </Screen>
  );
}

const styles = (t: ThemeTokens) =>
  StyleSheet.create({
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    // New: pills left, settings right
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    pillGroup: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      flexShrink: 1,
    },
    pillsRow: { flexDirection: 'row', gap: 12 },
    tagWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 999,
      backgroundColor: CHIP_BG,
      borderWidth: 1,
      borderColor: HAIRLINE,
    },
    rewardRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 10,
    },
    hairlineTop: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: HAIRLINE,
      marginTop: 10,
      paddingTop: 10,
    },
    redeemBtn: {
      backgroundColor: t.colors.primary, // the one solid CTA on screen
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 14,
    },
    recentRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 8,
    },
  });