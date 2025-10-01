// components/WeeklyChallengeCard.tsx
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTokens } from '../components/ThemeProvider';
import type { Plan } from '../hooks/usePlan';
import type { PairDoc } from '../types/models';
import { claimWeeklyReward, ensureWeekly } from '../utils/challenges';
import { listenPair } from '../utils/pairs';

type Props = {
  pairId: string;
  tzOffsetMinutes: number;
  plan: Plan; // 'free' | 'premium'
};

export default function WeeklyChallengeCard({ pairId, tzOffsetMinutes, plan }: Props) {
  const t = useTokens();

  const [progress, setProgress] = useState(0);
  const [target, setTarget] = useState(50);
  const [status, setStatus] = useState<'active' | 'completed' | 'missed'>('active');

  useEffect(() => {
    ensureWeekly(pairId, 50, tzOffsetMinutes).catch(console.warn);
    const unsub = listenPair(pairId, (p: (PairDoc & { id: string }) | null) => {
      const w = p?.weekly;
      if (!w) return;
      setProgress(w.progress ?? 0);
      setTarget(w.target ?? 50);
      setStatus(w.status ?? 'active');
    });
    return () => unsub && unsub();
  }, [pairId, tzOffsetMinutes, plan]);

  const pct = Math.min(100, Math.round((progress / Math.max(1, target)) * 100));

  const onClaim = async () => {
    const rewardId = 'AUTO_PICK';
    await claimWeeklyReward(pairId, rewardId, tzOffsetMinutes);
  };

  return (
    <View
      style={{
        backgroundColor: t.colors.card,
        borderRadius: t.radius.lg,
        padding: t.spacing.lg,
        shadowColor: '#000',
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 2,
      }}
    >
      <Text style={{ fontSize: 18, fontWeight: '700', color: t.colors.text }}>Weekly Challenge</Text>
      <Text style={{ marginTop: 6, color: t.colors.textDim }}>
        {progress} / {target} points • {pct}%
      </Text>

      <View style={{ height: 8, backgroundColor: t.colors.border, borderRadius: 999, marginTop: 8 }}>
        <View
          style={{
            width: `${pct}%`,
            height: 8,
            borderRadius: 999,
            backgroundColor: t.colors.primary,
          }}
        />
      </View>

      {status !== 'completed' && pct >= 80 && (
        <Text style={{ marginTop: 8, color: t.colors.text }}>🔥 Almost there! Plan your date idea.</Text>
      )}

      {status === 'active' && pct >= 100 && (
        <Pressable
          onPress={onClaim}
          style={{
            marginTop: 12,
            paddingVertical: 10,
            alignItems: 'center',
            borderRadius: 12,
            backgroundColor: t.colors.primary,
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '700' }}>Claim Reward</Text>
        </Pressable>
      )}

      {status === 'completed' && (
        <Text style={{ marginTop: 8, color: t.colors.text }}>✅ Completed — enjoy your date!</Text>
      )}
    </View>
  );
}