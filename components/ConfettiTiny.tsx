import { useEffect } from 'react';
import { Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { s } from './tokens';

/** Tiny emoji confetti burst. Re-render with a new `seed` to trigger. */
export default function ConfettiTiny({ seed }: { seed: number }) {
  const y1 = useSharedValue(0), o1 = useSharedValue(0);
  const y2 = useSharedValue(0), o2 = useSharedValue(0);
  const y3 = useSharedValue(0), o3 = useSharedValue(0);

  useEffect(() => {
    [o1, o2, o3].forEach(o => (o.value = 0));
    [y1, y2, y3].forEach(y => (y.value = 0));
    o1.value = withTiming(1, { duration: 80 }); y1.value = withTiming(-24, { duration: 500 });
    o2.value = withDelay(40, withTiming(1, { duration: 80 })); y2.value = withDelay(40, withTiming(-30, { duration: 520 }));
    o3.value = withDelay(80, withTiming(1, { duration: 80 })); y3.value = withDelay(80, withTiming(-20, { duration: 480 }));
    setTimeout(() => { o1.value = withTiming(0); o2.value = withTiming(0); o3.value = withTiming(0); }, 600);
  }, [seed]);

  const A = (y:any,o:any)=>( { transform: [{ translateY: y.value }], opacity: o.value } );
  return (
    <View pointerEvents="none" style={{ position: 'absolute', right: s.md, top: s.md, zIndex: 50 }}>
      <Animated.View style={useAnimatedStyle(()=>A(y1,o1))}><Text>🎉</Text></Animated.View>
      <Animated.View style={useAnimatedStyle(()=>A(y2,o2))}><Text>💖</Text></Animated.View>
      <Animated.View style={useAnimatedStyle(()=>A(y3,o3))}><Text>✨</Text></Animated.View>
    </View>
  );
}
