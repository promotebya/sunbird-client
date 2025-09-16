// screens/PaywallScreen.tsx
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Card from '../components/Card';
import ThemedText from '../components/ThemedText';
import { tokens } from '../components/tokens';
import { purchase, usePro } from '../utils/subscriptions';

export default function PaywallScreen() {
  const { hasPro, offerings } = usePro();
  const annual = offerings?.annual;
  const monthly = offerings?.monthly;

  if (hasPro) {
    return (
      <View style={styles.center}>
        <ThemedText variant="title">You’re Pro 💖</ThemedText>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: tokens.spacing.md }}>
      <View style={styles.hero}>
        <View style={styles.heroBadge}>
          <ThemedText variant="label" color="#fff">LovePoints+</ThemedText>
        </View>
        <ThemedText variant="display" style={{ marginTop: 8 }}>Keep love fresh, weekly</ThemedText>
        <ThemedText variant="subtitle" color={tokens.colors.textDim} center style={{ marginTop: 4 }}>
          Unlock premium challenges, nudges & cozy themes.
        </ThemedText>
      </View>

      <Card style={{ marginTop: tokens.spacing.md }}>
        {[
          'Premium challenge packs',
          'Romantic tiers that rotate weekly',
          'Partner nudges & bonus surprises',
          'Custom themes',
          'Export memories',
        ].map((x) => (
          <View key={x} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 6 }}>
            <ThemedText variant="display">✨</ThemedText>
            <ThemedText variant="body">{x}</ThemedText>
          </View>
        ))}

        <View style={{ height: tokens.spacing.md }} />

        {annual && (
          <Pressable onPress={() => purchase(annual)} style={styles.ctaPrimary}>
            <ThemedText variant="button" color="#fff">
              {annual.priceString}/year • 7-day trial
            </ThemedText>
          </Pressable>
        )}
        {monthly && (
          <Pressable onPress={() => purchase(monthly)} style={styles.ctaSecondary}>
            <ThemedText variant="button" color={tokens.colors.primary}>
              {monthly.priceString}/month
            </ThemedText>
          </Pressable>
        )}

        <ThemedText variant="caption" color={tokens.colors.textDim} center style={{ marginTop: 6 }}>
          Cancel anytime in Settings.
        </ThemedText>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hero: {
    alignItems: 'center',
    paddingVertical: tokens.spacing.lg,
    borderRadius: tokens.radius.lg,
    backgroundColor: '#FFF1F5',
    borderWidth: 1,
    borderColor: tokens.colors.cardBorder,
  },
  heroBadge: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
    backgroundColor: tokens.colors.primary,
  },
  ctaPrimary: {
    backgroundColor: tokens.colors.primary,
    borderRadius: tokens.radius.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  ctaSecondary: {
    marginTop: 8,
    backgroundColor: '#FCE7F3',
    borderRadius: tokens.radius.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
});
