// components/SegmentedControl.tsx
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import sharedStyles from './sharedStyles';
import ThemedText from './ThemedText';
import { tokens } from './tokens';

export type Segment = { value: string; label: string };
export type SegmentedControlProps = {
  items: Segment[];
  value: string;
  onChange: (value: string) => void;
};

const SegmentedControl: React.FC<SegmentedControlProps> = ({ items, value, onChange }) => {
  return (
    <View style={[sharedStyles.row, styles.wrap]}>
      {items.map((item) => {
        const selected = item.value === value;
        return (
          <Pressable
            key={item.value}
            onPress={() => onChange(item.value)}
            style={[
              sharedStyles.pill,
              styles.pill,
              selected && sharedStyles.pillSelected,
              selected && styles.pillSelected,
            ]}
          >
            <ThemedText
              variant="label"
              color={selected ? 'buttonTextPrimary' : 'textDim'}
              style={selected ? sharedStyles.pillTextSelected : sharedStyles.pillText}
            >
              {item.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    gap: tokens.spacing.xs,
  },
  pill: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  pillSelected: {
    borderColor: tokens.colors.primary,
  },
});

export default SegmentedControl;
