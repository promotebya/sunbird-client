// theme/themes.ts
export type ThemeName =
  | 'light-rose'
  | 'dark-rose'
  | 'ocean'
  | 'forest'
  | 'mono'
  | 'high-contrast';

export type Tokens = {
  colors: {
    bg: string;
    card: string;
    text: string;
    textDim: string;
    primary: string;
    border: string;
    success: string;
    danger: string;
  };
  spacing: { xs: number; s: number; md: number; lg: number; xl: number };
  radius: { sm: number; md: number; lg: number; pill: number };
  shadow: { card: any }; // keep 'any' if RN Shadow types get noisy
};

const base = {
  spacing: { xs: 6, s: 10, md: 16, lg: 22, xl: 28 },
  radius: { sm: 8, md: 12, lg: 16, pill: 999 },
  // simple shadow; tweak per platform in components if needed
  shadow: { card: { shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 2 } },
};

const lightRose: Tokens = {
  ...base,
  colors: {
    bg: '#FFFFFF',
    card: '#FFFFFF',
    text: '#0F172A',
    textDim: '#6B7280',
    primary: '#FF4F8B',
    border: '#E5E7EB',
    success: '#16A34A',
    danger: '#EF4444',
  },
};

const darkRose: Tokens = {
  ...base,
  colors: {
    bg: '#0B0F14',
    card: '#111827',
    text: '#F8FAFC',
    textDim: '#A0AEC0',
    primary: '#FF2E74',
    border: '#1F2937',
    success: '#22C55E',
    danger: '#F87171',
  },
};

const ocean: Tokens = {
  ...base,
  colors: {
    bg: '#FFFFFF',
    card: '#FFFFFF',
    text: '#0F172A',
    textDim: '#6B7280',
    primary: '#2FB4FF',
    border: '#E5E7EB',
    success: '#10B981',
    danger: '#EF4444',
  },
};

const forest: Tokens = {
  ...base,
  colors: {
    bg: '#FFFFFF',
    card: '#FFFFFF',
    text: '#0F172A',
    textDim: '#667085',
    primary: '#2FA56A',
    border: '#E6E8EB',
    success: '#16A34A',
    danger: '#D92D20',
  },
};

const mono: Tokens = {
  ...base,
  colors: {
    bg: '#FFFFFF',
    card: '#FFFFFF',
    text: '#111111',
    textDim: '#666666',
    primary: '#111111',
    border: '#EAEAEA',
    success: '#111111',
    danger: '#111111',
  },
};

const highContrast: Tokens = {
  ...base,
  colors: {
    bg: '#FFFFFF',
    card: '#FFFFFF',
    text: '#000000',
    textDim: '#1F1F1F',
    primary: '#000000',
    border: '#000000',
    success: '#000000',
    danger: '#000000',
  },
};

export const THEMES: Record<ThemeName, Tokens> = {
  'light-rose': lightRose,
  'dark-rose': darkRose,
  ocean,
  forest,
  mono,
  'high-contrast': highContrast,
};