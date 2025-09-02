import { Pressable, Text, View } from "react-native";
import { colors, radius, spacing } from "./tokens";

type Item = { label: string; value: string };
type Props = { items: Item[]; value: string; onChange: (v: string) => void };

export default function SegmentedControl({ items, value, onChange }: Props) {
  return (
    <View style={{ flexDirection: "row", marginBottom: spacing.md }}>
      {items.map((i) => {
        const selected = i.value === value;
        return (
          <Pressable
            key={i.value}
            onPress={() => onChange(i.value)}
            style={{
              paddingVertical: 8,
              paddingHorizontal: 14,
              borderRadius: radius.pill,
              backgroundColor: selected ? colors.primary : "#F1F2F6",
              marginRight: spacing.sm,
            }}
          >
            <Text style={{ color: selected ? "#fff" : colors.textDark, fontWeight: "700" }}>{i.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
