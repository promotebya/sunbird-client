import { Text, View } from 'react-native';
import Button from './Button';
import { s, type } from './tokens';

export default function EmptyState({
  emoji, title, tip, cta, onPress,
}: { emoji: string; title: string; tip?: string; cta?: string; onPress?: () => void; }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: s.xl, gap: s.md }}>
      <Text style={{ fontSize: 44 }}>{emoji}</Text>
      <Text style={{ ...type.h2, textAlign: 'center' }}>{title}</Text>
      {!!tip && <Text style={{ ...type.dim, textAlign: 'center' }}>{tip}</Text>}
      {!!cta && <Button variant="ghost" title={cta} onPress={onPress} />}
    </View>
  );
}
