// screens/HomeScreen.tsx
import { Ionicons } from '@expo/vector-icons';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
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
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import Button from '../components/Button';
import Card from '../components/Card';
import ProgressBar from '../components/ProgressBar';
import RedeemModal from '../components/RedeemModal';
import Screen from '../components/Screen';
import ThemedText from '../components/ThemedText';
import { useTokens, type ThemeTokens } from '../components/ThemeProvider';

import {
  SpotlightAutoStarter,
  SpotlightTarget,
  type SpotlightStep,
} from '../components/spotlight';

import { db } from '../firebaseConfig';
import useAuthListener from '../hooks/useAuthListener';
import usePointsTotal from '../hooks/usePointsTotal';
import useStreak from '../hooks/useStreak';
import { getPairId } from '../utils/partner';
import {
  addReward,
  listenRewards,
  redeemReward,
  type RewardDoc,
} from '../utils/rewards';

const WEEK_GOAL = 50;
const MILESTONES = [5, 10, 25, 50, 100, 200, 500];

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

const isIOS = Platform.OS === 'ios';

// Final step: highlight the real tab bar, but lift the tooltip bubble a bit
const FIRST_RUN_STEPS: SpotlightStep[] = [
  {
    id: 'welcome',
    targetId: null,
    title: 'Welcome to LovePoints 💖',
    text: 'Quick tour to get you started?',
    placement: 'bottom',
    allowBackdropTapToNext: true,
  },
  { id: 'link',     targetId: 'home-link-partner', title: 'Pair up',  text: 'Link with your partner to sync points and memories.' },
  { id: 'log',      targetId: 'home-log-task',     title: 'Log a task', text: 'Track a kind action and earn LovePoints.' },
  { id: 'reward',   targetId: 'home-add-reward',   title: 'Rewards',  text: 'Add a reward you can redeem with points.' },
  { id: 'ideas',    targetId: 'home-ideas-anchor', title: 'Ideas for today', text: 'Quick suggestions for easy wins.', placement: 'top', padding: 6 },
  { id: 'settings', targetId: 'home-settings',     title: 'Settings', text: 'Manage your profile, pairing, and notifications.' },
  isIOS
    ? ({
        id: 'nav',
        targetId: 'tabbar-anchor',
        title: 'Navigation',
        text: 'Use the tabs below to move around: Home, Memories, Reminders, Love Notes, Tasks, Challenges.',
        placement: 'top',
        padding: 0,           // don’t inflate the highlight
        tooltipOffset: 22,    // ⬅️ move bubble up (no effect on highlight)
        allowBackdropTapToNext: true,
      } as any)
    : {
        id: 'nav',
        targetId: null,
        title: 'Navigation',
        text: 'Use the tabs below to move around: Home, Memories, Reminders, Love Notes, Tasks, Challenges.',
        placement: 'bottom',
      },
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

function nextMilestone(total: number) {
  for (const m of MILESTONES) if (total < m) return { target: m, remaining: m - total };
  const target = MILESTONES[MILESTONES.length - 1] * 2;
  return { target, remaining: Math.max(0, target - total) };
}

export default function HomeScreen() {
  const t = useTokens();
  const s = useMemo(() => styles(t), [t]);
  const nav = useNavigation<any>();

  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();

  const { user } = useAuthListener();
  const { total, weekly } = usePointsTotal(user?.uid);
  const streak = useStreak(user?.uid);

  const [pairId, setPairId] = useState<string | null>(null);
  const [rewards, setRewards] = useState<RewardDoc[]>([]);
  const [recent, setRecent] = useState<PointsItem[]>([]);
  const [showAddReward, setShowAddReward] = useState(false);
  const [hideLinkBanner, setHideLinkBanner] = useState(false);

  useEffect(() => {
    (async () => {
      if (!user) return setPairId(null);
      setPairId(await getPairId(user.uid));
    })();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const off = listenRewards(user.uid, pairId ?? null, setRewards);
    return () => off && off();
  }, [user, pairId]);

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

          <SpotlightTarget id="home-settings">
            <Button label="Settings" variant="outline" onPress={() => nav.navigate('Settings')} />
          </SpotlightTarget>
        </View>
      </View>

      {/* Partner (Action card) */}
      {!pairId && !hideLinkBanner && (
        <SpotlightTarget id="home-link-partner">
          <Card style={{ marginBottom: 12, paddingVertical: 12, borderWidth: 1, borderColor: HAIRLINE }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: withAlpha(t.colors.primary, 0.08), alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="link" size={18} color={t.colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText variant="title">Link with your partner</ThemedText>
                <ThemedText variant="caption" color={t.colors.textDim}>Share points and memories together.</ThemedText>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 10 }}>
              <Button label="Link now" onPress={() => nav.navigate('PairingScan')} />
              <Button label="Later" variant="ghost" onPress={() => setHideLinkBanner(true)} />
            </View>
          </Card>
        </SpotlightTarget>
      )}

      {/* Weekly goal */}
      <Card style={{ marginBottom: 12, borderWidth: 1, borderColor: HAIRLINE }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
          <ThemedText variant="subtitle" style={{ flex: 1 }}>Weekly goal</ThemedText>
          <ThemedText variant="caption" color={t.colors.textDim}>{weekly} / {WEEK_GOAL} · {Math.max(0, WEEK_GOAL - weekly)} to go</ThemedText>
        </View>
        <ProgressBar value={weekly} max={WEEK_GOAL} height={8} trackColor="#EDEAF1" />
        <ThemedText variant="caption" color={t.colors.textDim} style={{ marginTop: 8 }}>{nudge}</ThemedText>
        <View style={{ marginTop: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <ThemedText variant="label" color={t.colors.textDim}>Next milestone</ThemedText>
            <ThemedText variant="label">{target} pts</ThemedText>
          </View>
          <ProgressBar value={totalPoints} max={target} height={6} trackColor="#EDEAF1" />
          <ThemedText variant="caption" color={t.colors.textDim} style={{ marginTop: 4 }}>{remaining} to go • {weekly} this week</ThemedText>
        </View>
        <View style={{ marginTop: 12, flexDirection: 'row' }}>
          <SpotlightTarget id="home-log-task">
            <Button label="Log a task" onPress={() => nav.navigate('Tasks')} />
          </SpotlightTarget>
          <View style={{ width: 12 }} />
          <SpotlightTarget id="home-add-reward">
            <Button label={rewards.length ? 'Add reward' : 'Add first reward'} variant="outline" onPress={() => setShowAddReward(true)} />
          </SpotlightTarget>
        </View>
      </Card>

      {/* Ideas */}
      <Card style={{ marginBottom: 12, borderWidth: 1, borderColor: HAIRLINE }}>
        <SpotlightTarget id="home-ideas-anchor" style={{ alignSelf: 'stretch' }}>
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <ThemedText variant="subtitle" style={{ flex: 1 }}>Ideas for today</ThemedText>
              <Pressable onPress={() => nav.navigate('Discover')} accessibilityRole="link">
                <ThemedText variant="label" color={t.colors.primary}>See more →</ThemedText>
              </Pressable>
              <View style={{ width: 12 }} />
              <Pressable onPress={() => setKey(k => k + 1)} accessibilityRole="button">
                <ThemedText variant="label" color={t.colors.primary}>🔀 Shuffle</ThemedText>
              </Pressable>
            </View>

            <View style={s.tagWrap}>
              {ideas.slice(0, 2).map(txt => (
                <Pressable key={txt} onPress={() => onIdea(txt)} style={s.chip} accessibilityRole="button">
                  <Ionicons name="sparkles" size={14} color={t.colors.textDim} />
                  <ThemedText variant="label" style={{ marginLeft: 6 }}>{txt}</ThemedText>
                </Pressable>
              ))}
            </View>
          </View>
        </SpotlightTarget>

        <View style={[s.tagWrap, { marginTop: 10 }]}>
          {ideas.slice(2).map(txt => (
            <Pressable key={txt} onPress={() => onIdea(txt)} style={s.chip} accessibilityRole="button">
              <Ionicons name="sparkles" size={14} color={t.colors.textDim} />
              <ThemedText variant="label" style={{ marginLeft: 6 }}>{txt}</ThemedText>
            </Pressable>
          ))}
        </View>
      </Card>

      {/* Rewards */}
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

      {/* Recent */}
      {recent.length > 0 ? (
        <Card style={{ marginBottom: 12, borderWidth: 1, borderColor: HAIRLINE }}>
          <ThemedText variant="subtitle" style={{ marginBottom: 8 }}>Recent activity</ThemedText>
          {recent.map((p, i) => (
            <View key={p.id} style={[s.recentRow, i > 0 && s.hairlineTop]}>
              <ThemedText variant="title" color={t.colors.primary}>{p.value > 0 ? `+${p.value}` : p.value}</ThemedText>
              <ThemedText variant="caption" color={t.colors.textDim} style={{ marginLeft: 8, flex: 1 }}>{p.reason ?? 'Points'}</ThemedText>
            </View>
          ))}
        </Card>
      ) : null}

      {/* Bottom nudge */}
      <Card style={{ marginBottom: 16, borderWidth: 1, borderColor: HAIRLINE }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: withAlpha(t.colors.primary, 0.08), alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="sparkles" size={18} color={t.colors.primary} />
          </View>
          <ThemedText variant="title">Try a tiny challenge tonight</ThemedText>
        </View>
        <ThemedText variant="caption" color={t.colors.textDim}>A small step keeps your streak healthy. Explore a quick challenge.</ThemedText>
        <View style={{ marginTop: 10 }}>
          <Button label="Open Challenges" variant="outline" onPress={() => nav.navigate('Challenges')} />
        </View>
      </Card>

      {/* Add reward modal */}
      <RedeemModal visible={showAddReward} onClose={() => setShowAddReward(false)} onCreate={onCreateReward} />

      {/* iOS: highlight matches the tab bar exactly */}
      {isIOS && (
        <SpotlightTarget
          id="tabbar-anchor"
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: tabBarHeight,
          }}
        >
          <View style={{ flex: 1 }} />
        </SpotlightTarget>
      )}

      <SpotlightAutoStarter uid={user?.uid ?? null} steps={FIRST_RUN_STEPS} persistKey="first-run-v3" />
    </Screen>
  );
}

const styles = (t: ThemeTokens) =>
  StyleSheet.create({
    headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
    pillGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, flexShrink: 1 },
    pillsRow: { flexDirection: 'row', gap: 12 },
    tagWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 999,
      backgroundColor: '#F3EEF6',
      borderWidth: 1,
      borderColor: '#F0E6EF',
    },
    rewardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 },
    hairlineTop: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#F0E6EF', marginTop: 10, paddingTop: 10 },
    redeemBtn: { backgroundColor: t.colors.primary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14 },
    recentRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  });