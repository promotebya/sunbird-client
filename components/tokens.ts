// components/tokens.ts
export const colors = {
  bg: '#FFFFFF',
  bgSubtle: '#F7F7FA',
  text: '#111827',
  textDim: '#6B7280',
  primary: '#FF4D8D',
  primaryDark: '#E63E80',
  border: '#EEEEEE',
  card: '#FFFFFF',
  success: '#16A34A',
  warning: '#F59E0B',
  danger: '#E65850',
  ghost: '#EEEEEE',
};

export const s = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24 };

export const r = { sm: 10, md: 14, lg: 20, pill: 999 };

export const type = {
  title: { fontSize: 28, fontWeight: '800' as const, color: colors.text },
  h2: { fontSize: 20, fontWeight: '700' as const, color: colors.text },
  body: { fontSize: 16, color: colors.text },
  dim: { fontSize: 14, color: colors.textDim },
};
