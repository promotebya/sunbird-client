// components/tokens.ts
export const colors = {
  primary: "#FF2E74",
  primaryDark: "#E61E65",
  surface: "#FFFFFF",
  background: "#F8F9FB",
  textDark: "#12131A",
  muted: "#8B8E98",
  success: "#22C55E",
  warning: "#F59E0B",
  danger: "#EF4444",
  border: "#ECECF1",
  placeholder: "#A1A1AA",
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24 };

export const radius = { sm: 12, md: 16, lg: 24, pill: 999 };

export const type = {
  display: { fontSize: 30, fontWeight: "800" as const, color: colors.textDark },
  h2: { fontSize: 21, fontWeight: "700" as const, color: colors.textDark },
  body: { fontSize: 16, fontWeight: "500" as const, color: colors.textDark },
  caption: { fontSize: 14, fontWeight: "600" as const, color: colors.muted },
};
