import * as Haptics from 'expo-haptics';
import { Text } from 'react-native';
import PressableScale from './PressableScale';
import { colors, r, s } from './tokens';

export default function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress?: () => void; }) {
  return (
    <PressableScale
      onPress={() => { Haptics.selectionAsync(); onPress?.(); }}
      style={{
        paddingVertical: 6, paddingHorizontal: 12, borderRadius: r.pill,
        backgroundColor: selected ? colors.primary : colors.ghost, marginRight: s.sm,
      }}
    >
      <Text style={{ color: selected ? '#fff' : colors.text, fontWeight: selected ? '700' : '500' }}>{label}</Text>
    </PressableScale>
  );
}
