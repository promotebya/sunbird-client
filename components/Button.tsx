// components/Button.tsx
import React from 'react';
import { Pressable, StyleSheet, ViewStyle } from 'react-native';
import ThemedText from './ThemedText';
import { tokens } from './tokens';

type ButtonVariant = 'primary' | 'secondary';

export type ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  style?: ViewStyle;
  disabled?: boolean;
};

const Button: React.FC<ButtonProps> = ({ label, onPress, variant = 'primary', style, disabled }) => {
  const isPrimary = variant === 'primary';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.base,
        isPrimary ? styles.primary : styles.secondary,
        disabled && styles.disabled,
        style,
      ]}
    >
      <ThemedText
        variant="button"
        color={isPrimary ? 'buttonTextPrimary' : 'buttonTextSecondary'}
        center
      >
        {label}
      </ThemedText>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  base: {
    paddingVertical: tokens.spacing.s + 2,
    paddingHorizontal: tokens.spacing.lg,
    borderRadius: tokens.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: {
    backgroundColor: tokens.colors.buttonPrimary,
  },
  secondary: {
    backgroundColor: tokens.colors.buttonSecondary,
    borderColor: tokens.colors.buttonPrimary,
    borderWidth: 1,
  },
  disabled: {
    opacity: 0.5,
  },
});

export default Button;
