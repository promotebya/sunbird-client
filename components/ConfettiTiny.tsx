// components/ConfettiTiny.tsx
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

const pieces = Array.from({ length: 10 });

const ConfettiTiny: React.FC = () => {
  return (
    <View pointerEvents="none" style={styles.wrap}>
      {pieces.map((_, i) => (
        <Burst key={i} delay={i * 40} />
      ))}
    </View>
  );
};

const Burst: React.FC<{ delay?: number }> = ({ delay = 0 }) => {
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const scale = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 1,
        duration: 800,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
        delay,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 800,
        easing: Easing.linear,
        useNativeDriver: true,
        delay,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: 400,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
        delay,
      }),
    ]).start();
  }, [delay, opacity, scale, translateY]);

  const y = translateY.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -60 - Math.random() * 20],
  });
  const x = (Math.random() - 0.5) * 60;

  return (
    <Animated.Text
      style={[
        styles.piece,
        {
          transform: [{ translateY: y }, { translateX: x }, { scale }],
          opacity,
        },
      ]}
    >
      🎊
    </Animated.Text>
  );
};

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 999,
  },
  piece: {
    fontSize: 14,
    position: 'absolute',
  },
});

export default ConfettiTiny;
