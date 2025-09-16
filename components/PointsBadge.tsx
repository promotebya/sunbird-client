// components/PointsBadge.tsx
import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, ViewStyle } from 'react-native';
import ThemedText from './ThemedText';
import { tokens } from './tokens';

type Props = {
  value: number;
  pop?: boolean;        // when true, badge scales briefly
  style?: ViewStyle;
};

export default function PointsBadge({ value, pop, style }: Props) {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!pop) return;
    scale.setValue(0.92);
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      friction: 4,
      tension: 140,
    }).start();
  }, [pop, scale]);

  return (
    <Animated.View style={[styles.wrap, { transform: [{ scale }] }, style]}>
      <ThemedText variant="title" color={tokens.colors.buttonTextPrimary}>
        {value}
      </ThemedText>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: tokens.colors.primary,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
