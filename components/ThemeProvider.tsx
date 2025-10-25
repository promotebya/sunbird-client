import { StatusBar } from 'expo-status-bar';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import useAuthListener from '../hooks/useAuthListener';
import { getUserPrefs } from '../utils/settings';

/* ── Theme shape ───────────────────────────────────────────── */

export type ThemeName =
  | 'light-rose'
  | 'dark-rose'
  | 'ocean'
  | 'forest'
  | 'mono'
  | 'high-contrast';

export type ThemeTokens = {
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
  bgGradient: { start: string; end: string };
  spacing: { xs: number; s: number; md: number; lg: number; xl: number };
  radius: { sm: number; md: number; lg: number; pill: number };
  shadow: { card: any };
};

const base = {
  spacing: { xs: 6, s: 10, md: 16, lg: 22, xl: 28 },
  radius: { sm: 8, md: 12, lg: 16, pill: 999 },
  shadow: {
    card: {
      shadowColor: 'rgba(0,0,0,0.08)',
      shadowOpacity: 1,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 3,
    },
  },
};

// iOS-like blue used on both platforms
const IOS_BLUE = '#3B82F6';

/**
 * Warmer, softer rose palettes:
 * - Light: gentle blush background, desaturated rose primary, warmer dim text.
 * - Dark: deep plum/rose neutrals, soft rose primary, warmer dim text.
 */
const THEMES: Record<ThemeName, ThemeTokens> = {
  'light-rose': {
    ...base,
    colors: {
      bg: '#FFF8FB',          // softer, slightly warmer than #FFF6FA
      card: '#FFFFFF',
      text: '#1E1519',        // warmer black
      textDim: '#7E6B75',     // warmer dim text
      primary: '#E86388',     // soft rose (less neon than #FF2E74)
      border: '#F6EDEF',      // warmer hairline
      success: '#3CCB7F',
      danger: '#E15B66',      // softened danger
    },
    bgGradient: { start: '#FFEFF6', end: '#FFF8FB' },
    shadow: {
      card: {
        ...base.shadow.card,
        // subtle rose-tinted shadow for warmth
        shadowColor: 'rgba(232, 99, 136, 0.12)',
        shadowRadius: 14,
        elevation: 4,
      },
    },
  },
  'dark-rose': {
    ...base,
    colors: {
      bg: '#120E13',          // warm, soft charcoal with rose hint
      card: '#1A141A',        // deep plum card
      text: '#F8F4F6',
      textDim: '#CBB7C1',     // warmer dim text
      primary: '#FF86A6',     // softer, lighter rose for dark bg
      border: '#2A2028',      // warm plum border
      success: '#22C55E',
      danger: '#F27D88',      // softened danger
    },
    bgGradient: { start: '#120E13', end: '#1A141A' },
    shadow: {
      card: {
        ...base.shadow.card,
        // keep subtle depth on dark while staying warm
        shadowColor: 'rgba(255, 134, 166, 0.18)',
        shadowRadius: 16,
        elevation: 5,
      },
    },
  },
  ocean: {
    ...base,
    colors: {
      bg: '#F7FBFF',
      card: '#FFFFFF',
      text: '#14202A',
      textDim: '#5C6470',
      primary: IOS_BLUE,
      border: '#E3ECF7',
      success: '#10B981',
      danger: '#EF4444',
    },
    bgGradient: { start: '#E9F3FF', end: '#F7FBFF' },
  },
  forest: {
    ...base,
    colors: {
      bg: '#FAFEFB',
      card: '#FFFFFF',
      text: '#0E1613',
      textDim: '#6B5F67',
      primary: '#21A072',
      border: '#E4EEE8',
      success: '#16A34A',
      danger: '#D92D20',
    },
    bgGradient: { start: '#EEF7F1', end: '#FAFEFB' },
  },
  mono: {
    ...base,
    colors: {
      bg: '#FAFAFB',
      card: '#FFFFFF',
      text: '#111111',
      textDim: '#5C6470',
      primary: '#111111',
      border: '#ECEDEF',
      success: '#111111',
      danger: '#111111',
    },
    bgGradient: { start: '#FAFAFB', end: '#FAFAFB' },
  },
  'high-contrast': {
    ...base,
    colors: {
      bg: '#FFFFFF',
      card: '#FFFFFF',
      text: '#000000',
      textDim: '#1F1F1F',
      primary: '#000000',
      border: '#DADDE1',
      success: '#000000',
      danger: '#000000',
    },
    bgGradient: { start: '#FFFFFF', end: '#FFFFFF' },
  },
};

/* ── Context ───────────────────────────────────────────── */

type ThemeContextType = {
  pref: ThemeName;
  resolved: 'light' | 'dark';
  themeName: ThemeName;
  tokens: ThemeTokens;
  setPref: (p: ThemeName) => void;
};

const DEFAULT_PREF: ThemeName = 'ocean';

const ThemeContext = createContext<ThemeContextType>({
  pref: DEFAULT_PREF,
  resolved: 'light',
  themeName: DEFAULT_PREF,
  tokens: THEMES[DEFAULT_PREF],
  setPref: () => {},
});

export const useThemeContext = () => useContext(ThemeContext);
export const useTokens = () => useThemeContext().tokens;

/* ── Helpers ───────────────────────────────────────────── */

function normalizeLegacy(value?: string | null): ThemeName {
  if (!value) return DEFAULT_PREF;
  if (value === 'system') return DEFAULT_PREF;
  if (value === 'light') return 'light-rose';
  if (value === 'dark') return 'dark-rose';
  const allowed: ThemeName[] = ['light-rose', 'dark-rose', 'ocean', 'forest', 'mono', 'high-contrast'];
  return (allowed.includes(value as ThemeName) ? value : DEFAULT_PREF) as ThemeName;
}

function resolveBrightness(name: ThemeName): 'light' | 'dark' {
  return name === 'dark-rose' ? 'dark' : 'light';
}

/* ── Provider ───────────────────────────────────────────── */

export const ThemeProvider: React.FC<React.PropsWithChildren<{}>> = ({ children }) => {
  const { user } = useAuthListener();

  const [pref, setPref] = useState<ThemeName>(DEFAULT_PREF);

  useEffect(() => {
    (async () => {
      if (!user) return;
      const p = await getUserPrefs(user.uid);
      if (p?.theme) setPref(normalizeLegacy(p.theme));
    })();
  }, [user]);

  const themeName: ThemeName = pref;
  const tokens = THEMES[themeName];
  const resolved = resolveBrightness(themeName);
  const barStyle = resolved === 'dark' ? 'light' : 'dark';

  const value = useMemo(
    () => ({ pref, resolved, themeName, tokens, setPref }),
    [pref, resolved, themeName, tokens]
  );

  return (
    <ThemeContext.Provider value={value}>
      <StatusBar style={barStyle} />
      {children}
    </ThemeContext.Provider>
  );
};