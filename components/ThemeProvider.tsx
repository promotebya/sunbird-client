// components/ThemeProvider.tsx
import { StatusBar } from 'expo-status-bar';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance, ColorSchemeName } from 'react-native';
import useAuthListener from '../hooks/useAuthListener';
import { getUserPrefs } from '../utils/settings';

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
  /** NEW: background wash per theme */
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
    bgGradient: { start: '#FFE8F1', end: '#FFF6FA' }, // very light
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
    bgGradient: { start: '#0B0F14', end: '#111827' }, // subtle dark wash
  },
  ocean: {
    ...base,
    colors: {
      bg: '#F7FBFF',
      card: '#FFFFFF',
      text: '#14202A',
      textDim: '#5C6470',
      primary: '#2E8CFF',
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
    bgGradient: { start: '#FAFAFB', end: '#FAFAFB' }, // solid
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
    bgGradient: { start: '#FFFFFF', end: '#FFFFFF' }, // solid
  },
};

type ThemePref =
  | 'system'
  | 'light'
  | 'dark'
  | 'light-rose'
  | 'dark-rose'
  | 'ocean'
  | 'forest'
  | 'mono'
  | 'high-contrast';

type ThemeContextType = {
  pref: ThemePref;
  resolved: 'light' | 'dark';
  themeName: ThemeName;
  tokens: ThemeTokens;
  setPref: (p: ThemePref) => void;
};

const ThemeContext = createContext<ThemeContextType>({
  pref: 'system',
  resolved: 'light',
  themeName: 'light-rose',
  tokens: THEMES['light-rose'],
  setPref: () => {},
});

export const useThemeContext = () => useContext(ThemeContext);
export const useTokens = () => useThemeContext().tokens;

export const ThemeProvider: React.FC<React.PropsWithChildren<{}>> = ({ children }) => {
  const { user } = useAuthListener();
  const [pref, setPref] = useState<ThemePref>('system');
  const [system, setSystem] = useState<ColorSchemeName>(Appearance.getColorScheme());

  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => setSystem(colorScheme));
    return () => sub.remove();
  }, []);

  useEffect(() => {
    (async () => {
      if (!user) return;
      const p = await getUserPrefs(user.uid);
      if (p?.theme) setPref(p.theme);
    })();
  }, [user]);

  const resolved: 'light' | 'dark' = useMemo(() => {
    if (pref === 'light') return 'light';
    if (pref === 'dark') return 'dark';
    return (system ?? 'light') as 'light' | 'dark';
  }, [pref, system]);

  const themeName: ThemeName = useMemo(() => {
    if (pref === 'system') return resolved === 'dark' ? 'dark-rose' : 'light-rose';
    if (pref === 'light') return 'light-rose';
    if (pref === 'dark') return 'dark-rose';
    return pref as ThemeName;
  }, [pref, resolved]);

  const tokens = THEMES[themeName];
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