// components/PressableScale.tsx
import { PropsWithChildren, useRef } from 'react';
import { Animated, Pressable, StyleProp, ViewStyle } from 'react-native';

type Props = PropsWithChildren<{
  onPress?: () => void;
  onLongPress?: () => void;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  activeScale?: number; // default 0.98
  hitSlop?: number | { left?: number; right?: number; top?: number; bottom?: number };
}>;

export default function PressableScale({
  children,
  onPress,
  onLongPress,
  style,
  disabled,
  activeScale = 0.98,
  hitSlop,
}: Props) {
  const scale = useRef(new Animated.Value(1)).current;

  const to = (v: number) =>
    Animated.spring(scale, { toValue: v, useNativeDriver: true, speed: 20, bounciness: 0 });

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={() => to(activeScale).start()}
      onPressOut={() => to(1).start()}
      hitSlop={hitSlop}
      style={style}
    >
      <Animated.View style={{ transform: [{ scale }] }}>{children}</Animated.View>
    </Pressable>
  );
}
