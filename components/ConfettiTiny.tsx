import { useEffect } from "react";
import { Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";

export default function ConfettiTiny({ seed }: { seed: number | string }) {
  const y1 = useSharedValue(0), y2 = useSharedValue(0), y3 = useSharedValue(0);
  const o1 = useSharedValue(0), o2 = useSharedValue(0), o3 = useSharedValue(0);

  const st1 = useAnimatedStyle(() => ({ transform: [{ translateY: y1.value }], opacity: o1.value }));
  const st2 = useAnimatedStyle(() => ({ transform: [{ translateY: y2.value }], opacity: o2.value }));
  const st3 = useAnimatedStyle(() => ({ transform: [{ translateY: y3.value }], opacity: o3.value }));

  useEffect(() => {
    [y1,y2,y3].forEach(sv => sv.value = 0); [o1,o2,o3].forEach(sv => sv.value = 0);
    o1.value = withTiming(1, { duration: 80 }); y1.value = withTiming(-24, { duration: 500 }); o1.value = withDelay(420, withTiming(0, { duration: 180 }));
    o2.value = withDelay(40, withTiming(1, { duration: 80 })); y2.value = withDelay(40, withTiming(-30, { duration: 520 })); o2.value = withDelay(460, withTiming(0, { duration: 180 }));
    o3.value = withDelay(80, withTiming(1, { duration: 80 })); y3.value = withDelay(80, withTiming(-20, { duration: 480 })); o3.value = withDelay(440, withTiming(0, { duration: 180 }));
  }, [seed]);

  return (
    <View pointerEvents="none" style={{ position: "absolute", right: 16, top: 16, zIndex: 50 }}>
      <Animated.View style={st1}><Text>🎉</Text></Animated.View>
      <Animated.View style={st2}><Text>💖</Text></Animated.View>
      <Animated.View style={st3}><Text>✨</Text></Animated.View>
    </View>
  );
}
