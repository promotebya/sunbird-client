// components/Chip.tsx
import React from 'react';
import { Pressable, StyleProp, StyleSheet, ViewStyle } from 'react-native';
import ThemedText from './ThemedText';
import { tokens } from './tokens';

type Props = {
  label: string;
  /** Preferred new prop (optional) */
  active?: boolean;
  /** Back-compat with older usage in your codebase (optional) */
  selected?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

const Chip: React.FC<Props> = ({ label, active, selected, onPress, style }) => {
  const isActive = (active ?? selected) ?? false;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={[styles.base, isActive && styles.active, style]}
    >
      <ThemedText variant="label" color={isActive ? '#fff' : tokens.colors.text}>
        {label}
      </ThemedText>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  base: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: '#F3F4F6',
    marginRight: tokens.spacing.xs,
  },
  active: {
    backgroundColor: tokens.colors.primary,
  },
});

export default Chip;
