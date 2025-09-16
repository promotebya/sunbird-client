// components/tokens.ts
// Central design tokens (colors/spacing/radius/shadows) + legacy aliases.
// Warm rose palette, gentle surfaces, release-safe.

export type SpacingScale = {
  xxs: number;
  xs: number;
  s: number;
  sm: number;   // alias for s (fixes older references)
  md: number;
  lg: number;
  xl: number;
  xxl: number;
};

export type RadiusScale = {
  s: number;
  md: number;
  lg: number;
  pill: number;
};

export type Colors = {
  // Brand
  primary: string;
  primaryDark: string;
  primarySoft: string;        // soft rose wash for subtle fills
  primarySoftBorder: string;  // matching border for soft fills

  // Surfaces
  screen: string;             // app background (gentle off-white)
  surface: string;            // generic surface (kept for compatibility)
  card: string;
  cardBorder: string;         // subtle card border
  bg: string;                 // legacy alias for screen

  // Text
  text: string;
  textDim: string;

  // Buttons (semantic aliases used across the app)
  buttonPrimary: string;
  buttonSecondary: string;
  buttonTextPrimary: string;
  buttonTextSecondary: string;

  // Feedback
  success: string;
  successBg: string;
  danger: string;
  dangerBg: string;
};

export type Shadows = {
  subtle: {
    shadowColor: string;
    shadowOpacity: number;
    shadowRadius: number;
    elevation: number;
  };
  card: {
    shadowColor: string;
    shadowOpacity: number;
    shadowRadius: number;
    elevation: number;
  };
};

export const spacing: SpacingScale = {
  xxs: 2,
  xs: 4,
  s: 8,
  sm: 8,   // alias
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const radius: RadiusScale = {
  s: 8,
  md: 12,
  lg: 16,
  pill: 9999,
};

export const colors: Colors = {
  // Brand (warmer rose)
  primary: '#E85D8C',
  primaryDark: '#D14D7F',
  primarySoft: '#FDE7EE',
  primarySoftBorder: '#F9C9DA',

  // Surfaces
  screen: '#FFF7FA',  // gentle off-white with rose tint
  surface: '#FFFFFF',
  card: '#FFFFFF',
  cardBorder: '#EDE9EE',
  bg: '#FFF7FA',      // legacy alias -> same as screen

  // Text
  text: '#1F2937',
  textDim: '#6B7280',

  // Buttons
  buttonPrimary: '#E85D8C',
  buttonSecondary: '#FFFFFF',
  buttonTextPrimary: '#FFFFFF',
  buttonTextSecondary: '#E85D8C',

  // Feedback
  success: '#16A34A',
  successBg: '#DCFCE7',
  danger: '#DC2626',
  dangerBg: '#FEE2E2',
};

export const shadows: Shadows = {
  subtle: {
    shadowColor: 'rgba(16,24,40,0.06)',
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
  },
  card: {
    shadowColor: 'rgba(16,24,40,0.08)',
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 4,
  },
};

// Convenience single shadow style for quick use (some files expect this)
export const shadowStyle = {
  shadowColor: 'rgba(16,24,40,0.08)',
  shadowOpacity: 1,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 6 },
  elevation: 3,
} as const;

// Keep a flat "tokens" export so existing imports keep working.
export const tokens = {
  spacing,
  radius,
  colors,
  shadows,
  shadowStyle,

  // Legacy aliases seen in older code
  r: radius,
  s: spacing,
  type: {} as Record<string, unknown>,

  // Old toast aliases
  success: colors.success,
  successBg: colors.successBg,
  danger: colors.danger,
  dangerBg: colors.dangerBg,
};

export type Tokens = typeof tokens;
export default tokens;
