// components/sharedStyles.ts
import { Platform, StyleSheet } from "react-native";
import { colors, radius, spacing, type } from "./tokens";

export const shared = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
  },
  title: { ...type.display, marginBottom: spacing.lg },
  row: { flexDirection: "row", alignItems: "center" },
  between: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    shadowColor: "#000",
    shadowOpacity: Platform.OS === "ios" ? 0.08 : 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: "#F1F2F6",
    marginRight: spacing.sm,
  },
  pillSelected: { backgroundColor: colors.primary },
  pillTextSelected: { color: "#fff", fontWeight: "700" },
});
