// screens/HomeScreen.tsx
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import Button from '../components/Button';
import Card from '../components/Card';
import EmptyState from '../components/EmptyState';
import ProgressBar from '../components/ProgressBar';
import RedeemModal from '../components/RedeemModal';
import Screen from '../components/Screen';
import ThemedText from '../components/ThemedText';
import { tokens } from '../components/tokens';

import useAuthListener from '../hooks/useAuthListener';
import usePointsTotal from '../hooks/usePointsTotal';
import useStreak from '../hooks/useStreak';
import { addReward, listenRewards, redeemReward, type RewardDoc } from '../utils/rewards';

const WEEK_GOAL = 50;

const QuickTile = ({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  onPress: () => void;
}) => (
  <Pressable onPress={onPress} style={styles.tile}>
    <Ionicons name={icon} size={20} color={tokens.colors.primary} />
    <View style={{ flex: 1, marginLeft: 10 }}>
      <ThemedText variant="title">{title}</ThemedText>
      <ThemedText variant="caption" color={tokens.colors.textDim}>
        {subtitle}
      </ThemedText>
    </View>
    <Ionicons name="chevron-forward" size={18} color={tokens.colors.textDim} />
  </Pressable>
);

const HomeScreen: React.FC = () => {
  const nav = useNavigation<any>();
  const { user } = useAuthListener();
  const { total, weekly } = usePointsTotal(user?.uid);
  const streak = useStreak(user?.uid);

  const [rewards, setRewards] = useState<RewardDoc[]>([]);
  const [showRedeem, setShowRedeem] = useState(false);

  useEffect(() => {
    if (!user) return;
    const off = listenRewards(user.uid, null, setRewards); // solo; pass pairId if you have it
    return () => off && off();
  }, [user]);

  const onCreateReward = async (title: string, cost: number) => {
    if (!user) return;
    await addReward(user.uid, null, title, cost);
  };

  const onRedeem = async (r: RewardDoc) => {
    if (!user) return;
    await redeemReward(user.uid, null, r);
  };

  return (
    <Screen>
      {/* Header */}
      <View style={styles.headerRow}>
        <ThemedText variant="display">Hi there 👋</ThemedText>
        <Button label="Settings" onPress={() => nav.navigate('Settings')} />
      </View>

      {/* Points */}
      <Card>
        <View style={styles.row}>
          <View style={styles.trophy}>
            <Ionicons name="trophy" size={22} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <ThemedText variant="caption" color={tokens.colors.textDim}>
              Total points
            </ThemedText>
            <ThemedText variant="display" color={tokens.colors.primary}>
              {total}
            </ThemedText>
          </View>
        </View>
      </Card>

      {/* Weekly progress */}
      <Card>
        <ThemedText variant="subtitle">Weekly goal</ThemedText>
        <ProgressBar value={weekly} max={WEEK_GOAL} />
        <ThemedText variant="caption" color={tokens.colors.textDim} style={{ marginTop: 4 }}>
          {weekly}/{WEEK_GOAL} this week • Streak {streak?.current ?? 0}🔥 (best {streak?.longest ?? 0})
        </ThemedText>

        <View style={{ marginTop: tokens.spacing.md }}>
          <Button label="Add reward" onPress={() => setShowRedeem(true)} />
        </View>
      </Card>

      {/* Rewards list or empty state */}
      {rewards.length > 0 ? (
        <View style={{ rowGap: tokens.spacing.s as number }}>
          {rewards.map((item) => (
            <Card key={item.id}>
              <View style={styles.rewardRow}>
                <View>
                  <ThemedText variant="title">{item.title}</ThemedText>
                  <ThemedText variant="caption" color={tokens.colors.textDim}>
                    Cost {item.cost} pts
                  </ThemedText>
                </View>
                <Pressable onPress={() => onRedeem(item)} style={styles.redeemBtn}>
                  <ThemedText variant="button" color="#fff">
                    Redeem
                  </ThemedText>
                </Pressable>
              </View>
            </Card>
          ))}
        </View>
      ) : (
        <EmptyState
          title="No rewards yet"
          body="Create a little motivation for the week."
          cta={<Button label="Add reward" onPress={() => setShowRedeem(true)} />}
        />
      )}

      {/* Quick actions */}
      <Card>
        <QuickTile
          icon="heart"
          title="Add Love Note"
          subtitle="Write something sweet"
          onPress={() => nav.navigate('LoveNotes')}
        />
        <View style={styles.divider} />
        <QuickTile
          icon="checkmark-done"
          title="Log a Task"
          subtitle="Do something kind"
          onPress={() => nav.navigate('Tasks')}
        />
        <View style={styles.divider} />
        <QuickTile
          icon="alarm"
          title="Set Reminder"
          subtitle="Don’t miss anniversaries"
          onPress={() => nav.navigate('Reminders')}
        />
      </Card>

      {/* Redeem modal */}
      <RedeemModal visible={showRedeem} onClose={() => setShowRedeem(false)} onCreate={onCreateReward} />
    </Screen>
  );
};

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spacing.md as number,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.s as unknown as number,
  },
  trophy: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: tokens.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: tokens.spacing.s,
  },
  tile: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rewardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  redeemBtn: {
    backgroundColor: tokens.colors.primary,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: 8,
    borderRadius: tokens.radius.md,
  },
});

export default HomeScreen;
