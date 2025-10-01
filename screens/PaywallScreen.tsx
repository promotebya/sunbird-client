// screens/PaywallScreen.tsx
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import Button from '../components/Button';
import Card from '../components/Card';
import ThemedText from '../components/ThemedText';
import { useTokens, type ThemeTokens } from '../components/ThemeProvider';

import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import useAuthListener from '../hooks/useAuthListener';
import { usePlanPlus } from '../hooks/usePlan';
import { purchase, restore, usePro } from '../utils/subscriptions';

type Plan = 'monthly' | 'yearly';

function withAlpha(hex: string, alpha: number) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const a = Math.round(alpha * 255).toString(16).padStart(2, '0');
  return `#${full}${a}`;
}

export default function PaywallScreen() {
  const t = useTokens();
  const s = useMemo(() => styles(t), [t]);

  const nav = useNavigation<any>();
  const route = useRoute<any>();
  const initialPlan: Plan = (route.params?.plan as Plan) ?? 'monthly';
  const [plan, setPlan] = useState<Plan>(initialPlan);
  const [busy, setBusy] = useState(false);

  // Current user
  const { user } = useAuthListener();

  // Mock store (scoped by uid inside usePro)
  const { hasPro, offerings, loading: rcLoading } = usePro(user?.uid);
  const annual = offerings?.annual;
  const monthly = offerings?.monthly;

  // Firestore plan (app source of truth)
  const { isPremium, loading: planLoading } = usePlanPlus(user?.uid);

  const effectivePremium = !!(isPremium || hasPro);

  // Close once either RC entitlement OR Firestore plan is active
  useEffect(() => {
    if (!planLoading && effectivePremium) nav.goBack();
  }, [effectivePremium, planLoading, nav]);

  if (!planLoading && effectivePremium) {
    return (
      <View style={s.center}>
        <Ionicons name="sparkles" size={22} color={t.colors.primary} />
        <ThemedText variant="title" style={{ marginTop: 8 }}>You’re Premium 💖</ThemedText>
        <ThemedText variant="caption" color={t.colors.textDim} style={{ marginTop: 4 }}>
          Thanks for supporting us!
        </ThemedText>
      </View>
    );
  }

  const yearlyPrice = annual?.priceString ?? '€19.99';
  const monthlyPrice = monthly?.priceString ?? '€2.99';

  async function markUserPremium() {
    if (!user?.uid) return;
    try {
      await setDoc(
        doc(db, 'users', user.uid),
        { plan: 'premium' },
        { merge: true }
      );
    } catch (e) {
      console.warn('[Paywall] failed to mark user premium', e);
    }
  }

  async function handleBuy(p: Plan) {
    try {
      const pkg = p === 'yearly' ? annual : monthly;
      if (!pkg) {
        Alert.alert('Store not ready', 'Please try again in a moment.');
        return;
      }
      setBusy(true);
      const ok = await purchase(pkg);
      if (ok) {
        // Reflect Premium in Firestore so the rest of the app unlocks.
        await markUserPremium();
        // Don’t goBack here; the effect above will close once hooks reflect it.
      } else {
        Alert.alert('Purchase canceled');
      }
    } catch (e: any) {
      Alert.alert('Purchase failed', e?.message ?? 'Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function handleRestore() {
    try {
      setBusy(true);
      const ok = await restore();
      if (ok) {
        await markUserPremium();
      } else {
        Alert.alert('Nothing to restore', 'No active purchases found for this Apple ID.');
      }
    } catch (e: any) {
      Alert.alert('Restore failed', e?.message ?? 'Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView
      contentContainerStyle={{ padding: t.spacing.md }}
      style={{ backgroundColor: t.colors.bg }}
      showsVerticalScrollIndicator={false}
    >
      {/* Hero */}
      <View style={s.hero}>
        <View style={s.heroBadge}>
          <Ionicons name="sparkles" size={14} color="#fff" />
          <ThemedText variant="label" color="#fff" style={{ marginLeft: 6 }}>
            LovePoints+
          </ThemedText>
        </View>
        <ThemedText variant="display" center style={{ marginTop: 8 }}>
          Keep love fresh, weekly
        </ThemedText>
        <ThemedText variant="subtitle" color={t.colors.textDim} center style={{ marginTop: 4 }}>
          Unlock premium challenges, nudges & cozy themes.
        </ThemedText>
      </View>

      {/* Benefits */}
      <Card style={{ marginTop: t.spacing.md }}>
        {[
          '12 curated challenges every week',
          'New drops weekly — fun, romantic or surprising',
          '200+ romantic, playful & competitive challenges',
          'One subscription covers both partners',
        ].map((x) => (
          <View key={x} style={s.benefitRow}>
            <Ionicons name="checkmark-circle" size={16} color={t.colors.primary} style={s.benefitIcon} />
            <ThemedText variant="body" style={s.benefitText}>{x}</ThemedText>
          </View>
        ))}

        {/* Plan chooser */}
        <View style={{ height: t.spacing.md }} />
        <View style={s.planToggle}>
          <Pressable
            onPress={() => setPlan('monthly')}
            style={[s.planChip, plan === 'monthly' && s.planChipActive]}
            accessibilityRole="button"
          >
            <ThemedText variant="label" color={plan === 'monthly' ? '#fff' : t.colors.text}>
              Monthly
            </ThemedText>
            <ThemedText variant="caption" color={plan === 'monthly' ? '#fff' : t.colors.textDim}>
              {monthlyPrice}/mo
            </ThemedText>
          </Pressable>

          <Pressable
            onPress={() => setPlan('yearly')}
            style={[s.planChip, plan === 'yearly' && s.planChipActive]}
            accessibilityRole="button"
          >
            <ThemedText variant="label" color={plan === 'yearly' ? '#fff' : t.colors.text}>
              Yearly
            </ThemedText>
            <ThemedText
              variant="caption"
              color={plan === 'yearly' ? '#fff' : t.colors.textDim}
              style={{ marginTop: 2 }}
            >
              {yearlyPrice}/yr
            </ThemedText>
            <View style={s.valueTagBelow}>
              <ThemedText variant="caption" color={plan === 'yearly' ? t.colors.primary : '#fff'}>
                Best value
              </ThemedText>
            </View>
          </Pressable>
        </View>

        {/* CTA */}
        <Button
          label={
            busy
              ? 'Unlocking…'
              : plan === 'yearly' ? `${yearlyPrice}/year` : `${monthlyPrice}/month`
          }
          onPress={() => handleBuy(plan)}
          disabled={busy || rcLoading || (!annual && !monthly)}
          style={{ marginTop: t.spacing.s }}
        />

        <View style={{ marginTop: t.spacing.s, alignItems: 'center' }}>
          {busy ? <ActivityIndicator /> : (
            <Pressable onPress={handleRestore} accessibilityRole="button">
              <ThemedText variant="label" color={t.colors.primary}>Restore purchases</ThemedText>
            </Pressable>
          )}
        </View>

        <ThemedText variant="caption" color={t.colors.textDim} center style={{ marginTop: 8 }}>
          Cancel anytime. Auto-renews until canceled in Settings.
        </ThemedText>
      </Card>
    </ScrollView>
  );
}

const styles = (t: ThemeTokens) =>
  StyleSheet.create({
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: t.colors.bg, padding: t.spacing.md },
    hero: {
      alignItems: 'center',
      paddingVertical: t.spacing.lg,
      borderRadius: t.radius.lg,
      backgroundColor: withAlpha(t.colors.primary, 0.08),
      borderWidth: 1,
      borderColor: t.colors.border,
    },
    heroBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: t.colors.primary,
    },
    // Bullet alignment (icon vertically centered with multi-line text)
    benefitRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 6 },
    benefitIcon: { marginTop: 0 },
    benefitText: { marginLeft: 8, lineHeight: 22, flex: 1 },

    planToggle: {
      flexDirection: 'row',
      backgroundColor: t.colors.card,
      borderColor: t.colors.border,
      borderWidth: 1,
      padding: 4,
      borderRadius: t.radius.pill,
      gap: 4,
    },
    planChip: {
      flex: 1,
      paddingVertical: 10,
      paddingHorizontal: 12,
      alignItems: 'center',
      borderRadius: t.radius.pill,
    },
    planChipActive: { backgroundColor: t.colors.primary },

    // “Best value” shown *under* the €19.99/yr text
    valueTagBelow: {
      marginTop: 6,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: t.radius.pill,
      backgroundColor: withAlpha('#000', 0.18),
    },
  });