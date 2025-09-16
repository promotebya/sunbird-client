// components/ThemeProvider.tsx
import { StatusBar } from 'expo-status-bar';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance, ColorSchemeName } from 'react-native';
import useAuthListener from '../hooks/useAuthListener';
import { getUserPrefs } from '../utils/settings';

type ThemePref = 'system' | 'light' | 'dark';

type ThemeContextType = {
  pref: ThemePref;
  resolved: 'light' | 'dark';
  setPref: (p: ThemePref) => void;
};

const ThemeContext = createContext<ThemeContextType>({
  pref: 'system',
  resolved: 'light',
  setPref: () => {},
});

export const useThemeContext = () => useContext(ThemeContext);

export const ThemeProvider: React.FC<React.PropsWithChildren<{}>> = ({ children }) => {
  const { user } = useAuthListener();
  const [pref, setPref] = useState<ThemePref>('system');
  const [system, setSystem] = useState<ColorSchemeName>(Appearance.getColorScheme());

  // Watch OS theme changes
  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => setSystem(colorScheme));
    return () => sub.remove();
  }, []);

  // Load saved preference on sign-in
  useEffect(() => {
    (async () => {
      if (!user) return;
      const p = await getUserPrefs(user.uid);
      if (p.theme) setPref(p.theme);
    })();
  }, [user]);

  const resolved: 'light' | 'dark' = useMemo(() => {
    if (pref === 'light') return 'light';
    if (pref === 'dark') return 'dark';
    return (system ?? 'light') as 'light' | 'dark';
  }, [pref, system]);

  const barStyle = resolved === 'dark' ? 'light' : 'dark';
  const value = useMemo(() => ({ pref, resolved, setPref }), [pref, resolved]);

  return (
    <ThemeContext.Provider value={value}>
      <StatusBar style={barStyle} />
      {children}
    </ThemeContext.Provider>
  );
};
