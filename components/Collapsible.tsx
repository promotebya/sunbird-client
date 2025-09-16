// components/Collapsible.tsx
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import ThemedText from './ThemedText';
import ThemedView from './ThemedView';
// ⬇️ use NAMED import (matches your file's export)
import { tokens } from '../components/tokens';
import { IconSymbol } from './ui/IconSymbol';

type Props = {
  title: string;
  children?: React.ReactNode;
  defaultOpen?: boolean;
};

const Collapsible: React.FC<Props> = ({ title, children, defaultOpen = false }) => {
  const [open, setOpen] = useState(defaultOpen);
  const rotate = useRef(new Animated.Value(defaultOpen ? 1 : 0)).current;
  const [contentHeight, setContentHeight] = useState<number | null>(defaultOpen ? undefined as any : 0);
  const heightAnim = useRef(new Animated.Value(defaultOpen ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(rotate, {
      toValue: open ? 1 : 0,
      duration: 180,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();

    Animated.timing(heightAnim, {
      toValue: open ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
  }, [open, rotate, heightAnim]);

  const rotateInterpolate = rotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  const onLayoutContent = (e: any) => {
    if (contentHeight == null || contentHeight === 0) {
      setContentHeight(e.nativeEvent.layout.height);
    }
  };

  const animatedStyle =
    contentHeight == null
      ? {}
      : {
          height: heightAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [0, contentHeight],
          }),
          overflow: 'hidden' as const,
        };

  return (
    <ThemedView style={styles.wrapper}>
      <Pressable style={styles.header} onPress={() => setOpen((o) => !o)}>
        <ThemedText variant="title">{title}</ThemedText>
        <Animated.View style={{ transform: [{ rotate: rotateInterpolate }] }}>
          <IconSymbol name="chevron.down" size={18} color={tokens.colors.textDim} />
        </Animated.View>
      </Pressable>

      {/* Measure content once */}
      <View style={styles.measure} onLayout={onLayoutContent}>
        {contentHeight == null ? children : null}
      </View>

      {/* Animated content */}
      {contentHeight != null && (
        <Animated.View style={[styles.content, animatedStyle]}>
          <View>{children}</View>
        </Animated.View>
      )}
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: tokens.colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: tokens.spacing.md,
    paddingTop: tokens.spacing.s,
    paddingBottom: tokens.spacing.s,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: tokens.spacing.s,
  },
  content: {
    paddingTop: tokens.spacing.s,
  },
  // hidden box to measure natural height
  measure: {
    position: 'absolute',
    opacity: 0,
    left: 0,
    right: 0,
  },
});

export default Collapsible;
