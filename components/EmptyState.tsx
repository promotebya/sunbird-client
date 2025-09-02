import { Text, View } from "react-native";
import Button from "./Button";
import { colors, spacing, type } from "./tokens";

type Props = { emoji: string; title: string; hint?: string; cta?: string; onPress?: () => void };

export default function EmptyState({ emoji, title, hint, cta, onPress }: Props) {
  return (
    <View style={{ alignItems: "center", paddingVertical: spacing.xl }}>
      <Text style={{ fontSize: 40 }}>{emoji}</Text>
      <Text style={{ ...type.h2, marginTop: spacing.sm }}>{title}</Text>
      {!!hint && <Text style={{ ...type.caption, marginTop: spacing.xs, color: colors.muted }}>{hint}</Text>}
      {!!cta && <Button title={cta} onPress={onPress} style={{ marginTop: spacing.lg }} />}
    </View>
  );
}
