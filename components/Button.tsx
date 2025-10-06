import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useMemo, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import ThemedText from './ThemedText';
import { useTokens } from './ThemeProvider';

type Variant = 'primary' | 'tonal' | 'outline' | 'ghost' | 'destructive';

export type ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  style?: ViewStyle;
  disabled?: boolean;
  loading?: boolean;
  iconLeft?: keyof typeof Ionicons.glyphMap;
  iconRight?: keyof typeof Ionicons.glyphMap;
  testID?: string;
};

export default function Button({
  label,
  onPress,
  variant = 'tonal',
  style,
  disabled,
  loading,
  iconLeft,
  iconRight,
  testID,
}: ButtonProps) {
  const t = useTokens();
  const pressY = useRef(new Animated.Value(0)).current; // 0=rest, 1=pressed

  const isPrimary = variant === 'primary';
  const isTonal = variant === 'tonal';
  const isOutline = variant === 'outline';
  const isGhost = variant === 'ghost';
  const isDestructive = variant === 'destructive';

  const withAlpha = (hex: string, a01: number) => {
    const h = hex.replace('#', '');
    const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
    const r = parseInt(full.slice(0, 2), 16);
    const g = parseInt(full.slice(2, 4), 16);
    const b = parseInt(full.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${a01})`;
  };

  const hexToRgb = (hex: string) => {
    const h = hex.replace('#', '');
    const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
    return {
      r: parseInt(full.slice(0, 2), 16),
      g: parseInt(full.slice(2, 4), 16),
      b: parseInt(full.slice(4, 6), 16),
    };
  };
  const toHex = (n: number) => n.toString(16).padStart(2, '0').toUpperCase();
  /** Mix a color with white, returning a solid hex (avoids translucent banding on Android). */
  const mixWithWhite = (hex: string, whiteRatio: number) => {
    const { r, g, b } = hexToRgb(hex);
    const t = Math.min(1, Math.max(0, whiteRatio));
    const R = Math.round(r * (1 - t) + 255 * t);
    const G = Math.round(g * (1 - t) + 255 * t);
    const B = Math.round(b * (1 - t) + 255 * t);
    return `#${toHex(R)}${toHex(G)}${toHex(B)}`;
  };

  // Palette per variant (keeps iOS look, improves Android)
  const palette = useMemo(() => {
    if (isPrimary) {
      return {
        bg: t.colors.primary,
        border: withAlpha(t.colors.primary, 0.32),
        text: '#FFFFFF',
        icon: '#FFFFFF',
        gradTop: withAlpha('#FFFFFF', 0.10),
        gradBot: withAlpha('#FFFFFF', 0.00),
        ripple: withAlpha('#FFFFFF', 0.22),
        elevation: 3,
      } as const;
    }
    if (isDestructive) {
      const red = '#DC2626';
      return {
        bg: '#FFFFFF',
        border: red,
        text: red,
        icon: red,
        gradTop: withAlpha('#FFFFFF', 0.06),
        gradBot: withAlpha('#FFFFFF', 0.00),
        ripple: withAlpha(red, 0.12),
        elevation: 0,
      } as const;
    }
    if (isOutline) {
      return {
        bg: '#FFFFFF',
        border: withAlpha(t.colors.primary, 0.40),
        text: t.colors.primary,
        icon: t.colors.primary,
        gradTop: 'transparent',
        gradBot: 'transparent',
        ripple: withAlpha(t.colors.primary, 0.10),
        elevation: 0,
      } as const;
    }
    if (isGhost) {
      return {
        bg: 'transparent',
        border: 'transparent',
        text: t.colors.primary,
        icon: t.colors.primary,
        gradTop: 'transparent',
        gradBot: 'transparent',
        ripple: withAlpha(t.colors.primary, 0.12),
        elevation: 0,
      } as const;
    }
    // tonal (default)
    return {
      // On Android, use a SOLID mixed color instead of semi-transparent RGBA.
      bg: Platform.OS === 'android' ? mixWithWhite(t.colors.primary, 0.86) : withAlpha(t.colors.primary, 0.14),
      border: Platform.OS === 'android' ? mixWithWhite(t.colors.primary, 0.72) : withAlpha(t.colors.primary, 0.28),
      text: t.colors.primary,
      icon: t.colors.primary,
      gradTop: Platform.OS === 'ios' ? withAlpha('#FFFFFF', 0.10) : 'transparent',
      gradBot: 'transparent',
      ripple: withAlpha(t.colors.primary, 0.12),
      elevation: Platform.OS === 'android' ? 0 : 2,
    } as const;
  }, [isPrimary, isOutline, isGhost, isDestructive, t.colors.primary]);

  const translateY = pressY.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
  const shadowOpacity = pressY.interpolate({ inputRange: [0, 1], outputRange: [0.14, 0.08] });
  const elevation = pressY.interpolate({
    inputRange: [0, 1],
    outputRange: [palette.elevation, Math.max(0, palette.elevation - 1)],
  });

  const onPressIn = () =>
    Animated.timing(pressY, { toValue: 1, duration: 120, useNativeDriver: true }).start();
  const onPressOut = () =>
    Animated.timing(pressY, { toValue: 0, duration: 120, useNativeDriver: true }).start();

  const isClickable = !disabled && !loading && !!onPress;

  // Android text fix: remove decoration + tighten metrics to avoid mid-line artifact
  const androidTextFix: TextStyle | undefined =
    Platform.OS === 'android'
      ? { includeFontPadding: false, textAlignVertical: 'center' as any, textDecorationLine: 'none', textDecorationColor: 'transparent' }
      : undefined;

  return (
    <Pressable
      onPress={onPress}
      onPressIn={isClickable ? onPressIn : undefined}
      onPressOut={isClickable ? onPressOut : undefined}
      disabled={!isClickable}
      accessibilityRole="button"
      accessibilityState={{ disabled: !isClickable }}
      testID={testID}
      android_ripple={
        Platform.OS === 'android'
          ? { color: palette.ripple, radius: 240, borderless: false }
          : undefined
      }
      style={[
        styles.hit,
        Platform.OS === 'android' ? { overflow: 'hidden' } : null,
        style,
        isGhost && { paddingHorizontal: 4, paddingVertical: 6 },
        (!isClickable || loading) && { opacity: 0.6 },
      ]}
    >
      <Animated.View
        style={[
          styles.base,
          (isPrimary || isTonal || isOutline) && {
            backgroundColor: palette.bg,
            borderColor: palette.border,
            borderWidth: isOutline ? 1 : isTonal ? 1 : StyleSheet.hairlineWidth,
          },
          isGhost && styles.ghost,
          !isGhost &&
            Platform.select({
              ios: {
                shadowColor: 'rgba(0,0,0,1)',
                shadowOpacity: shadowOpacity as any,
                shadowRadius: 10,
                shadowOffset: { width: 0, height: 6 },
              },
              android: {
                elevation: elevation as any,
                backgroundColor: palette.bg,
              },
            }),
          { transform: [{ translateY }] },
        ]}
      >
        {/* Gradient kept for iOS only to avoid Android banding/line artifacts */}
        {(isPrimary || isTonal) && Platform.OS === 'ios' ? (
          <LinearGradient
            colors={[palette.gradTop, palette.gradBot]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
        ) : null}

        {/* Subtle top highlight — iOS only */}
        {(isPrimary || isTonal || isOutline) && Platform.OS === 'ios' ? (
          <View pointerEvents="none" style={styles.innerHighlight} />
        ) : null}

        {iconLeft && !loading ? (
          <Ionicons name={iconLeft} size={18} color={palette.icon} style={{ marginRight: 8 }} />
        ) : null}

        {loading ? (
          <ActivityIndicator size="small" color={palette.icon} style={{ marginRight: 8 }} />
        ) : null}

        <ThemedText
          variant="button"
          color={palette.text}
          center
          numberOfLines={1}
          style={androidTextFix}
        >
          {label}
        </ThemedText>

        {iconRight ? (
          <Ionicons name={iconRight} size={18} color={palette.icon} style={{ marginLeft: 8 }} />
        ) : null}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hit: {
    borderRadius: 16,
  },
  base: {
    minHeight: 48,
    paddingHorizontal: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    backfaceVisibility: 'hidden',
  },
  ghost: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    minHeight: 40,
  },
  innerHighlight: {
    position: 'absolute',
    left: 8,
    right: 8,
    top: 1,
    height: 1,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
});