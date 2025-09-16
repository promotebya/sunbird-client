import tokens from 'components/tokens';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { PairDoc, Plan } from 'types/models';
import { claimWeeklyReward, ensureWeekly } from 'utils/challenges';
import { listenPair } from 'utils/pairs';

type Props = {
  pairId: string;
  tzOffsetMinutes: number;
  plan: Plan; // 'free' | 'pro'
};

export default function WeeklyChallengeCard({ pairId, tzOffsetMinutes, plan }: Props) {
  const [progress, setProgress] = useState(0);
  const [target, setTarget] = useState(50);
  const [status, setStatus] = useState<'active' | 'completed' | 'missed'>('active');

  useEffect(() => {
    // Ensure the doc exists/updated this week
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
    const rewardId = 'AUTO_PICK'; // TODO: wire to your picker
    await claimWeeklyReward(pairId, rewardId, tzOffsetMinutes);
  };

  return (
    <View
      style={{
        backgroundColor: '#fff',
        borderRadius: (tokens.radius?.lg ?? tokens.r?.lg ?? 16),
        padding: (tokens.spacing?.lg ?? tokens.s?.lg ?? 16),
        shadowColor: '#000',
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 2
      }}
    >
      <Text style={{ fontSize: 18, fontWeight: '700', color: tokens.colors?.text ?? '#222' }}>
        Weekly Challenge
      </Text>
      <Text style={{ marginTop: 6 }}>
        {progress} / {target} points • {pct}%
      </Text>

      <View style={{ height: 8, backgroundColor: '#eee', borderRadius: 999, marginTop: 8 }}>
        <View
          style={{
            width: `${pct}%`,
            height: 8,
            borderRadius: 999,
            backgroundColor: tokens.colors?.primary ?? '#FF4F8B'
          }}
        />
      </View>

      {status !== 'completed' && pct >= 80 && (
        <Text style={{ marginTop: 8 }}>🔥 Almost there! Plan your date idea.</Text>
      )}

      {status === 'active' && pct >= 100 && (
        <Pressable
          onPress={onClaim}
          style={{
            marginTop: 12,
            paddingVertical: 10,
            alignItems: 'center',
            borderRadius: 12,
            backgroundColor: tokens.colors?.primary ?? '#FF4F8B'
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '700' }}>Claim Reward</Text>
        </Pressable>
      )}

      {status === 'completed' && <Text style={{ marginTop: 8 }}>✅ Completed — enjoy your date!</Text>}
    </View>
  );
}
