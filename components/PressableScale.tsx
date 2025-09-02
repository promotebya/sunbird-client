import { PropsWithChildren } from "react";
import { Pressable, PressableProps } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

const APressable = Animated.createAnimatedComponent(Pressable);

export default function PressableScale({ children, onPressIn, onPressOut, style, ...rest }: PropsWithChildren<PressableProps>) {
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <APressable
      {...rest}
      onPressIn={(e) => { scale.value = withTiming(0.98, { duration: 120 }); onPressIn?.(e); }}
      onPressOut={(e) => { scale.value = withTiming(1, { duration: 120 }); onPressOut?.(e); }}
      style={[anim, style]}
    >
      {children}
    </APressable>
  );
}
