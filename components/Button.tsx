import { ActivityIndicator, Pressable, StyleSheet, Text, ViewStyle } from "react-native";
import { colors, radius, spacing } from "./tokens";

type Props = {
  title: string;
  onPress?: () => void;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle | ViewStyle[];
  small?: boolean;
  variant?: "primary" | "ghost" | "danger" | "link";
};

export default function Button({ title, onPress, loading, disabled, style, small, variant = "primary" }: Props) {
  const isPrimary = variant === "primary";
  const isDanger = variant === "danger";
  const isLink = variant === "link";
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.base,
        small && styles.small,
        isPrimary && styles.primary,
        isDanger && styles.danger,
        variant === "ghost" && styles.ghost,
        isLink && styles.linkBtn,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary || isDanger ? "#fff" : colors.textDark} />
      ) : (
        <Text style={[
          styles.txt,
          (isPrimary || isDanger) && styles.txtLight,
          isLink && styles.linkTxt
        ]}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 54,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
  },
  small: { height: 44, borderRadius: radius.lg, paddingHorizontal: spacing.md },
  primary: { backgroundColor: colors.primary, borderColor: colors.primary },
  danger: { backgroundColor: colors.danger, borderColor: colors.danger },
  ghost: { backgroundColor: "#F1F2F6" },
  txt: { fontWeight: "700", color: colors.textDark },
  txtLight: { color: "#fff" },
  linkBtn: { backgroundColor: "transparent", borderColor: "transparent", height: undefined, paddingVertical: spacing.sm },
  linkTxt: { color: "#2563EB", fontWeight: "700" },
});
