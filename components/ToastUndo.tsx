// components/ToastUndo.tsx
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, PanResponder, Platform, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ThemedText from './ThemedText';
import { useTokens } from './ThemeProvider';

type Props = {
  visible: boolean;
  message: string;
  actionLabel?: string;
  onAction?: () => void | Promise<void>;
  onHide?: () => void;
  /** Auto-hide after N ms (0 disables). Default 900. */
  durationMs?: number;
};

const ToastUndo: React.FC<Props> = ({
  visible,
  message,
  actionLabel = 'Undo',
  onAction,
  onHide,
  durationMs = 900,
}) => {
  const t = useTokens();
  const insets = useSafeAreaInsets();

  const translateY = useRef(new Animated.Value(60)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startAutoHide = () => {
    if (!durationMs) return;
    clearAutoHide();
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
    [message]
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
            backgroundColor: t.colors.card,
            borderColor: t.colors.border,
            borderRadius: t.radius.lg,
            paddingHorizontal: t.spacing.md,
            paddingVertical: t.spacing.s,
            elevation: Platform.OS === 'android' ? 2 : 0,
            shadowColor: '#000',
          },
        ]}
      >
        <Ionicons name="sparkles" size={18} color={t.colors.primary} style={{ marginRight: 10 }} />
        <ThemedText variant="label" style={{ flex: 1 }} color={t.colors.primary}>
          {message}
        </ThemedText>

        {onAction ? (
          <Pressable
            onPress={onAction}
            style={[
              styles.action,
              {
                borderColor: t.colors.primary,
                paddingVertical: 6,
                paddingHorizontal: 10,
                borderRadius: 999,
              },
            ]}
            accessibilityRole="button"
          >
            <ThemedText variant="label" color={t.colors.primary}>
              {actionLabel}
            </ThemedText>
          </Pressable>
        ) : null}
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
  action: {
    marginLeft: 10,
    borderWidth: 1,
  },
});

export default ToastUndo;