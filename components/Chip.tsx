import { Pressable, Text } from "react-native";
import { shared } from "./sharedStyles";

type Props = { label: string; selected?: boolean; onPress?: () => void };
export default function Chip({ label, selected, onPress }: Props) {
  return (
    <Pressable onPress={onPress} style={[shared.pill, selected && shared.pillSelected]}>
      <Text style={[selected && shared.pillTextSelected]}>{label}</Text>
    </Pressable>
  );
}
