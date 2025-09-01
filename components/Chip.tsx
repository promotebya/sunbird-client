import React from 'react';
import { Pressable, StyleSheet, Text, ViewStyle } from 'react-native';

type Props = {
  label: string;
  onPress: () => void;
  style?: ViewStyle;
};

export default function Chip({ label, onPress, style }: Props) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.chip, style, pressed && { opacity: 0.8 }]}>
      <Text style={styles.text}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#FDECF2',
    borderColor: '#F7B7CC',
    borderWidth: 1,
    borderRadius: 20,
    marginRight: 8,
    marginBottom: 8,
  },
  text: { color: '#B84772', fontWeight: '700' },
});
