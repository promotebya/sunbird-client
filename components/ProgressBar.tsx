// components/ProgressBar.tsx
import { StyleSheet, View } from 'react-native';
import { tokens } from './tokens';

export default function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = Math.max(0, Math.min(1, max > 0 ? value / max : 0));
  return (
    <View style={styles.wrap}>
      <View style={[styles.fill, { width: `${pct * 100}%` }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    height: 10,
    borderRadius: 999,
    backgroundColor: '#F3F4F6',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: tokens.colors.primary,
  },
});
