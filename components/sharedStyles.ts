// components/sharedStyles.ts
import { StyleSheet } from 'react-native';
import { tokens } from './tokens';

export const sharedStyles = StyleSheet.create({
  // Layout
  screen: {
    flex: 1,
    // use the warmer app background (alias still exists as colors.bg, but screen is clearer)
    backgroundColor: tokens.colors.screen,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  // Cards & surfaces
  card: {
    backgroundColor: tokens.colors.card,
    borderRadius: tokens.radius.md,
    padding: tokens.spacing.lg,
    borderWidth: 1,
    borderColor: tokens.colors.cardBorder,
    ...tokens.shadowStyle, // soft, modern elevation
  },
  // Softer, tinted card (nice for banners/info)
  cardSoft: {
    backgroundColor: tokens.colors.primarySoft,
    borderRadius: tokens.radius.md,
    padding: tokens.spacing.lg,
    borderWidth: 1,
    borderColor: tokens.colors.primarySoftBorder,
  },
  subtle: {
    ...tokens.shadows.subtle,
  },
  divider: {
    height: 1,
    backgroundColor: tokens.colors.cardBorder,
  },

  // Pills / SegmentedControl
  pill: {
    borderRadius: tokens.radius.pill,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.cardBorder,
  },
  pillSelected: {
    backgroundColor: tokens.colors.primary,
    borderColor: tokens.colors.primary,
  },
  pillText: {
    color: tokens.colors.textDim,
  },
  pillTextSelected: {
    color: tokens.colors.buttonTextPrimary,
  },

  // “Chip” like container
  chip: {
    borderRadius: tokens.radius.pill,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: tokens.colors.primarySoft,
    borderWidth: 1,
    borderColor: tokens.colors.primarySoftBorder,
  },
  chipSelected: {
    backgroundColor: tokens.colors.primary,
    borderColor: tokens.colors.primary,
  },
  chipText: {
    color: tokens.colors.textDim,
  },
  chipTextSelected: {
    color: tokens.colors.buttonTextPrimary,
  },
});

export type SharedStyles = typeof sharedStyles;
export default sharedStyles;
