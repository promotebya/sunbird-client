// components/ProgressBar.tsx
import { useEffect, useRef } from 'react';
import { Animated, I18nManager, StyleSheet, View, ViewStyle } from 'react-native';
import { useTokens } from './ThemeProvider';

type Props = {
  value: number;         // current
  max: number;           // total
  height?: number;       // bar height (default 8)
  rounded?: boolean;     // rounded ends (default true)
  style?: ViewStyle;     // outer style override
  trackColor?: string;   // override neutral track
  tintColor?: string;    // override fill color
  animate?: boolean;     // animate width changes (default true)
};

export default function ProgressBar({
  value,
  max,
  height = 8,
  rounded = true,
  style,
  trackColor,
  tintColor,
  animate = true,
}: Props) {
  const t = useTokens();
  const clamped = Math.max(0, Math.min(value, max));
  const pct = max > 0 ? clamped / max : 0;

  // Animated width (LTR/RTL aware)
  const anim = useRef(new Animated.Value(pct)).current;
  useEffect(() => {
    if (!animate) {
      anim.setValue(pct);
      return;
    }
    Animated.timing(anim, { toValue: pct, duration: 240, useNativeDriver: false })
      .start();
  }, [pct, animate, anim]);

  // Colors (sand-friendly)
  const TRACK = trackColor ?? '#EDE6DB';
  const FILL  = tintColor ?? withAlpha(t.colors.primary, 0.85);

  const radius = rounded ? height / 2 : 4;

  const widthAnim = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  }) as Animated.AnimatedInterpolation<string | number>;

  // For RTL we invert using right instead of left
  const sideStyle = I18nManager.isRTL ? { right: 0 } : { left: 0 };

  return (
    <View
      style={[
        styles.container,
        { height, borderRadius: radius, backgroundColor: TRACK },
        style,
      ]}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, now: clamped, max }}
      accessibilityLabel={`Progress: ${clamped} of ${max}`}
    >
      <Animated.View
        style={[
          styles.fill,
          sideStyle,
          { width: widthAnim },
          { backgroundColor: FILL, borderRadius: radius },
        ]}
      >
        {/* inner top highlight for depth */}
        <View
          pointerEvents="none"
          style={[
            styles.highlight,
            {
              borderTopLeftRadius: radius,
              borderTopRightRadius: radius,
              opacity: 0.28,
            },
          ]}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  fill: {
    position: 'absolute',
    top: 0,
    bottom: 0,
  },
  highlight: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: StyleSheet.hairlineWidth + 1, // ~1px
    backgroundColor: '#FFFFFF',
  },
});

// tiny alpha helper
function withAlpha(hex: string, alpha: number) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const a = Math.round(alpha * 255).toString(16).padStart(2, '0');
  return `#${full}${a}`;
}