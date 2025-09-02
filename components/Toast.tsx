import { useEffect } from 'react';
import { Animated, Text } from 'react-native';
import { colors, r, s } from './tokens';

export type ToastVariant = 'default' | 'success' | 'danger';

export default function Toast({
  visible, message, variant = 'default', onHide, duration = 1600,
}: { visible: boolean; message: string; variant?: ToastVariant; onHide?: () => void; duration?: number; }) {
  const opacity = new Animated.Value(0);
  useEffect(() => {
    if (!visible) return;
    Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start(() => onHide?.());
  }, [visible]);

  const bg = variant === 'success' ? colors.success
    : variant === 'danger' ? colors.danger
    : '#111827';

  return visible ? (
    <Animated.View style={{
      position: 'absolute', left: s.lg, right: s.lg, bottom: s.xl,
      backgroundColor: bg, borderRadius: r.lg, padding: s.lg, opacity,
    }}>
      <Text style={{ color: '#fff', fontWeight: '700', textAlign: 'center' }}>{message}</Text>
    </Animated.View>
  ) : null;
}
