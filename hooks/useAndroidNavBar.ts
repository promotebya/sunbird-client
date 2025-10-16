// hooks/useAndroidNavBar.ts
import * as NavigationBar from 'expo-navigation-bar';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { useTokens } from '../components/ThemeProvider';

export default function useAndroidNavBar() {
  const t = useTokens();

  useEffect(() => {
    if (Platform.OS !== 'android') return;

    (async () => {
      try {
        // Solid color behind the bottom tabs so no white strip peeks through
        await NavigationBar.setBackgroundColorAsync?.(t.colors.bg);
      } catch {}

      try {
        // Pick button style to keep good contrast; tweak if your theme exposes isDark
        const preferLightIcons =
          typeof (t as any).isDark === 'boolean' ? (t as any).isDark : false;
        await (NavigationBar as any).setButtonStyleAsync?.(
          preferLightIcons ? 'light' : 'dark'
        );
      } catch {}

      try {
        // Play nicely with gesture insets
        await NavigationBar.setBehaviorAsync?.('inset-swipe');
        await NavigationBar.setVisibilityAsync?.('visible');
      } catch {}
    })();
  }, [t.colors.bg]);
}