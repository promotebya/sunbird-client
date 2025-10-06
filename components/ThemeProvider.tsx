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

const THEMES: Record<ThemeName, ThemeTokens> = {
  'light-rose': {
    ...base,
    colors: {
      bg: '#FFF6FA',
      card: '#FFFFFF',
      text: '#1F1A1C',
      textDim: '#6B5F67',
      primary: '#FF2E74',
      border: '#F1E6EB',
      success: '#3CCB7F',
      danger: '#EF4444',
    },
    bgGradient: { start: '#FFE8F1', end: '#FFF6FA' },
  },
  'dark-rose': {
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
    bgGradient: { start: '#0B0F14', end: '#111827' },
  },
  ocean: {
    ...base,
    colors: {
      bg: '#F7FBFF',
      card: '#FFFFFF',
      text: '#14202A',
      textDim: '#5C6470',
      primary: IOS_BLUE,        // ⬅ unified iOS-like blue
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