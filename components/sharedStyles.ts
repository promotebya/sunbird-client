// components/sharedStyles.ts
import { StyleSheet } from 'react-native';
import { colors, r, s, type } from './tokens';

export const shared = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: s.lg, paddingTop: s.xl },
  title: { ...type.title, marginBottom: s.lg },
  row: { flexDirection: 'row', alignItems: 'center' },
  spaceBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },

  card: {
    backgroundColor: colors.card,
    borderRadius: r.lg,
    padding: s.lg,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },

  chip: {
    paddingVertical: 6, paddingHorizontal: 12, borderRadius: r.pill,
    backgroundColor: colors.ghost, marginRight: s.sm,
  },
  chipSelected: { backgroundColor: colors.primary },
  chipTextSelected: { color: '#fff', fontWeight: '700' },

  btn: { height: 48, borderRadius: r.md, alignItems: 'center', justifyContent: 'center' },
  btnPrimary: { backgroundColor: colors.primary },
  btnDanger: { backgroundColor: colors.danger },
  btnGhost: { backgroundColor: colors.ghost },
  btnText: { color: '#fff', fontWeight: '700' },

  input: {
    backgroundColor: colors.bg,
    borderWidth: 1, borderColor: colors.border, borderRadius: r.md,
    paddingHorizontal: s.lg, paddingVertical: 12,
    color: colors.text,
  },

  toast: {
    position: 'absolute', left: s.lg, right: s.lg, bottom: s.xl,
    backgroundColor: '#111827', borderRadius: r.lg, padding: s.lg, zIndex: 999,
  },
  toastText: { color: '#fff', fontWeight: '700', textAlign: 'center' },
});
