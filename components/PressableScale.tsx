import { PropsWithChildren } from 'react';
import { Pressable, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

type Props = PropsWithChildren<{
  style?: ViewStyle | ViewStyle[]; disabled?: boolean; onPress?: () => void; onLongPress?: () => void;
}>;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function PressableScale({ children, style, disabled, onPress, onLongPress }: Props) {
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <AnimatedPressable
      style={[anim, style as any]}
      disabled={disabled}
      onPressIn={() => { scale.value = withTiming(0.98, { duration: 80 }); }}
      onPressOut={() => { scale.value = withTiming(1, { duration: 120 }); }}
      onPress={onPress}
      onLongPress={onLongPress}
    >
      {children}
    </AnimatedPressable>
  );
}
