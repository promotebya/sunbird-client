// components/Toast.tsx
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, PanResponder, Platform, StyleSheet, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ThemedText from './ThemedText';
import { useTokens, type ThemeTokens } from './ThemeProvider';

export type ToastVariant = 'success' | 'danger';
export type ToastProps = {
  visible: boolean;
  message: string;
  variant?: ToastVariant;
  style?: ViewStyle;
  /** Auto-hide after N ms (default 900). Set 0 to disable. */
  durationMs?: number;
  /** Called when user swipes it away or auto-hide triggers */
  onHide?: () => void;
};

const iconByVariant: Record<ToastVariant, keyof typeof Ionicons.glyphMap> = {
  success: 'checkmark-circle',
  danger: 'alert-circle',
};

function accentColor(t: ThemeTokens, v: ToastVariant) {
  if (v === 'danger') return t.colors.danger;
  // @ts-ignore – theme may expose success; otherwise fallback to primary
  return (t.colors.success ?? t.colors.primary) as string;
}

const Toast: React.FC<ToastProps> = ({
  visible,
  message,
  variant = 'success',
  style,
  durationMs = 900,
  onHide,
}) => {
  const t = useTokens();
  const insets = useSafeAreaInsets();

  const translateY = useRef(new Animated.Value(60)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const accent = useMemo(() => accentColor(t, variant), [t, variant]);

  const startAutoHide = () => {
    if (!durationMs) return;
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => animateOut(onHide), durationMs);
  };
  const clearAutoHide = () => {
    if (!hideTimer.current) return;
    clearTimeout(hideTimer.current);
    hideTimer.current = null;
  };

  const animateIn = () => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 140, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, bounciness: 6 }),
    ]).start();
  };
  const animateOut = (cb?: () => void) => {
    clearAutoHide();
    Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: 120, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 200, duration: 150, useNativeDriver: true }),
    ]).start(() => cb?.());
  };

  useEffect(() => {
    if (visible) {
      animateIn();
      startAutoHide();
    } else {
      clearAutoHide();
      opacity.setValue(0);
      translateY.setValue(60);
    }
    return () => clearAutoHide();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, message]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_e, g) =>
          Math.abs(g.dy) > Math.abs(g.dx) && (g.dy > 4 || g.dy < -4),
        onPanResponderGrant: clearAutoHide,
        onPanResponderMove: (_e, g) => {
          if (g.dy > 0) translateY.setValue(g.dy);
        },
        onPanResponderRelease: (_e, g) => {
          const shouldDismiss = g.dy > 60 || g.vy > 1.0;
          if (shouldDismiss) animateOut(onHide);
          else {
            Animated.spring(translateY, {
              toValue: 0,
              useNativeDriver: true,
              bounciness: 6,
            }).start(() => startAutoHide());
          }
        },
        onPanResponderTerminate: () => {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 6,
          }).start(() => startAutoHide());
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [message, variant]
  );

  if (!visible) return null;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.wrapper,
        {
          left: t.spacing.md,
          right: t.spacing.md,
          bottom: (insets.bottom || 16) + t.spacing.lg,
          opacity,
          transform: [{ translateY }],
          zIndex: 999,
        },
      ]}
    >
      <Animated.View
        {...panResponder.panHandlers}
        accessibilityRole="alert"
        style={[
          styles.toast,
          {
            backgroundColor: t.colors.card, // clean surface, no glass
            borderColor: t.colors.border,
            borderRadius: t.radius.lg,
            shadowColor: '#000',
            paddingHorizontal: t.spacing.md,
            paddingVertical: t.spacing.s,
            elevation: Platform.OS === 'android' ? 2 : 0,
          },
          style,
        ]}
      >
        <Ionicons
          name={iconByVariant[variant]}
          size={18}
          color={accent}
          style={{ marginRight: 10, marginTop: Platform.OS === 'ios' ? 1 : 0 }}
        />
        <ThemedText variant="label" style={{ flex: 1 }} color={accent}>
          {message}
        </ThemedText>
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrapper: { position: 'absolute' },
  toast: {
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
  },
});

export default Toast;