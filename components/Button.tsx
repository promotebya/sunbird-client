// components/Button.tsx
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useMemo, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Platform,
  Pressable,
  StyleSheet,
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

  const colors = t.colors;
  const withAlpha = (hex: string, a01: number) => {
    const h = hex.replace('#', '');
    const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
    const a = Math.round(a01 * 255).toString(16).padStart(2, '0');
    return `#${full}${a}`;
  };

  // palette per variant
  const palette = useMemo(() => {
    if (isPrimary) {
      return {
        bg: colors.primary,
        border: withAlpha(colors.primary, 0.32),
        text: '#FFFFFF',
        icon: '#FFFFFF',
        gradientTop: withAlpha('#FFFFFF', 0.08),
        gradientBot: withAlpha('#FFFFFF', 0.00),
      };
    }
    if (isDestructive) {
      const red = '#DC2626';
      return {
        bg: '#FFFFFF',
        border: red,
        text: red,
        icon: red,
        gradientTop: withAlpha('#FFFFFF', 0.06),
        gradientBot: withAlpha('#FFFFFF', 0.00),
      };
    }
    if (isOutline) {
      return {
        bg: '#FFFFFF',
        border: withAlpha(colors.primary, 0.40),
        text: colors.primary,
        icon: colors.primary,
        gradientTop: withAlpha('#FFFFFF', 0.06),
        gradientBot: withAlpha('#FFFFFF', 0.00),
      };
    }
    if (isGhost) {
      return {
        bg: 'transparent',
        border: 'transparent',
        text: colors.primary,
        icon: colors.primary,
        gradientTop: 'transparent',
        gradientBot: 'transparent',
      };
    }
    // tonal (default)
    return {
      bg: withAlpha(colors.primary, 0.14),
      border: withAlpha(colors.primary, 0.28),
      text: colors.primary,
      icon: colors.primary,
      gradientTop: withAlpha('#FFFFFF', 0.08),
      gradientBot: withAlpha('#FFFFFF', 0.00),
    };
  }, [colors, isPrimary, isOutline, isGhost, isDestructive]);

  const translateY = pressY.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
  const shadowOpacity = pressY.interpolate({ inputRange: [0, 1], outputRange: [0.14, 0.08] });
  const elevation = pressY.interpolate({ inputRange: [0, 1], outputRange: [4, 2] });

  const onPressIn = () =>
    Animated.timing(pressY, { toValue: 1, duration: 120, useNativeDriver: true }).start();
  const onPressOut = () =>
    Animated.timing(pressY, { toValue: 0, duration: 120, useNativeDriver: true }).start();

  const isClickable = !disabled && !loading && !!onPress;

  return (
    <Pressable
      onPress={onPress}
      onPressIn={isClickable ? onPressIn : undefined}
      onPressOut={isClickable ? onPressOut : undefined}
      disabled={!isClickable}
      accessibilityRole="button"
      testID={testID}
      android_ripple={Platform.OS === 'android' ? { color: 'rgba(0,0,0,0.06)', radius: 240 } : undefined}
      style={({ pressed }) => [
        styles.hit,
        Platform.OS === 'android' ? { overflow: 'hidden' } : null,
        style,
        isGhost && { paddingHorizontal: 4, paddingVertical: 6 }, // lighter footprint for links
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
          !isGhost && Platform.select({
            ios: {
              shadowColor: 'rgba(0,0,0,1)',
              shadowOpacity: shadowOpacity as any,
              shadowRadius: 10,
              shadowOffset: { width: 0, height: 6 },
            },
            android: { elevation: elevation as any, backgroundColor: palette.bg },
          }),
          { transform: [{ translateY }] },
        ]}
      >
        {(isPrimary || isTonal || isOutline) && (
          <LinearGradient
            colors={[palette.gradientTop, palette.gradientBot]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
        )}

        {(isPrimary || isTonal || isOutline) && (
          <View pointerEvents="none" style={styles.innerHighlight} />
        )}

        {iconLeft && !loading ? (
          <Ionicons name={iconLeft} size={18} color={palette.icon} style={{ marginRight: 8 }} />
        ) : null}

        {loading ? (
          <ActivityIndicator size="small" color={palette.icon} style={{ marginRight: 8 }} />
        ) : null}

        <ThemedText variant="button" color={palette.text} center numberOfLines={1}>
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