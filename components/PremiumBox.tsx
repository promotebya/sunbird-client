import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Platform, StyleSheet, TextStyle, View, ViewStyle } from 'react-native';
import Button from './Button';
import ThemedText from './ThemedText';
import { useTokens } from './ThemeProvider';

type Props = {
  title?: string;
  subtitle?: string;
  features?: string[];
  style?: ViewStyle;
  onPrimary?: () => void;
  primaryLabel?: string;
  onSecondary?: () => void;
  secondaryLabel?: string;
};

export default function PremiumBox({
  title = 'Premium',
  subtitle = 'Unlock all features',
  features = ['Unlimited memories', 'Advanced reminders', 'Bonus challenges', 'Priority support'],
  style,
  onPrimary,
  primaryLabel = 'Start free trial',
  onSecondary,
  secondaryLabel = 'Restore purchases',
}: Props) {
  const t = useTokens();

  const mixWithWhite = (hex: string, ratio = 0.88) => {
    const h = hex.replace('#', '');
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    const m = (c: number) => Math.round(c * (1 - ratio) + 255 * ratio);
    const toHex = (n: number) => n.toString(16).padStart(2, '0');
    return `#${toHex(m(r))}${toHex(m(g))}${toHex(m(b))}`;
  };

  const androidFill = mixWithWhite(t.colors.primary, 0.88);
  const rimColor = Platform.OS === 'android' ? androidFill : t.colors.border;

  const titleFix: TextStyle = Platform.OS === 'android' ? { includeFontPadding: false } : {};

  return (
    <View
      style={[
        styles.box,
        {
          backgroundColor: Platform.OS === 'android' ? androidFill : t.colors.card,
          // ⬇️ Hairline “same-color” border kills the dark rim on Android
          borderWidth: Platform.OS === 'android' ? StyleSheet.hairlineWidth : 1,
          borderColor: rimColor,
          // No elevation on Android (prevents halos)
          elevation: 0,
        },
        style,
      ]}
    >
      {/* iOS glossy sheen only */}
      {Platform.OS === 'ios' && (
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(255,255,255,0.22)', 'rgba(255,255,255,0)']}
          style={StyleSheet.absoluteFill}
        />
      )}

      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            backgroundColor: Platform.OS === 'android' ? mixWithWhite(t.colors.primary, 0.76) : `${t.colors.primary}22`,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 10,
          }}
        >
          <Ionicons name="sparkles" size={18} color={t.colors.primary} />
        </View>

        <View style={{ flex: 1 }}>
          <ThemedText variant="title" style={titleFix}>{title}</ThemedText>
          <ThemedText variant="caption" color={t.colors.textDim} style={titleFix}>
            {subtitle}
          </ThemedText>
        </View>
      </View>

      {/* Features */}
      <View style={{ marginTop: 12, gap: 8 }}>
        {features.map((f) => (
          <View key={f} style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="checkmark-circle" size={18} color={t.colors.primary} style={{ marginRight: 8 }} />
            <ThemedText variant="label">{f}</ThemedText>
          </View>
        ))}
      </View>

      {/* CTAs */}
      <View style={{ marginTop: 14, gap: 10 }}>
        <Button variant="primary" label={primaryLabel} onPress={onPrimary} />
        {onSecondary ? <Button variant="ghost" label={secondaryLabel} onPress={onSecondary} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderRadius: 16,
    padding: 14,
    overflow: 'hidden',
  },
});