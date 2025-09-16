// components/Toast.tsx
import React from 'react';
import { Animated, StyleSheet, ViewStyle } from 'react-native';
import ThemedText from './ThemedText';
import { tokens } from './tokens';

export type ToastVariant = 'success' | 'danger';
export type ToastProps = {
  visible: boolean;
  message: string;
  variant?: ToastVariant;
  style?: ViewStyle;
};

const bgByVariant = {
  success: tokens.colors.successBg,
  danger: tokens.colors.dangerBg,
};

const colorByVariant = {
  success: tokens.colors.success,
  danger: tokens.colors.danger,
};

const Toast: React.FC<ToastProps> = ({ visible, message, variant = 'success', style }) => {
  if (!visible) return null;

  return (
    <Animated.View style={[styles.container, { backgroundColor: bgByVariant[variant] }, style]}>
      <ThemedText variant="label" color={colorByVariant[variant]}>
        {message}
      </ThemedText>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: tokens.spacing.s,
    paddingHorizontal: tokens.spacing.md,
    borderRadius: tokens.radius.md,
    alignSelf: 'center',
  },
});

export default Toast;
